import { z } from "zod";

import {
  normalizeSearchIntent,
  stableDigest,
} from "../../core/idempotency.js";
import type { JsonValue, SearchDiscovery } from "../../shared/types.js";
import type {
  SearchProvider,
  SearchRequest,
  SearchResponse,
} from "./contracts.js";
import { SafeProviderError } from "./provider-error.js";

type FetchLike = typeof fetch;

const responseSchema = z
  .object({
    error: z.string().optional(),
    search_metadata: z
      .object({
        id: z.string().min(1),
        status: z.string().min(1),
      })
      .passthrough()
      .optional(),
    organic_results: z
      .array(
        z
          .object({
            position: z.number().int().positive().optional(),
            title: z.string().min(1).optional(),
            link: z.string().url().optional(),
            snippet: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export interface SerpApiProviderOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

function validatedOfficialDomains(domains: string[]): string[] {
  if (domains.length > 8) {
    throw new SafeProviderError({
      code: "provider_request_rejected",
      provider: "serpapi",
      message: "SerpApi request has too many official domains.",
    });
  }

  return domains.map((domain) => {
    if (
      domain.length > 253 ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
        domain,
      )
    ) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "serpapi",
        message: "SerpApi request contains an invalid official domain.",
      });
    }
    return domain;
  });
}

export function buildRestrictedSearchQuery(
  query: string,
  officialDomains: string[],
): string {
  if (officialDomains.length === 0) return query;
  const restrictions = officialDomains
    .map((domain) => `site:${domain}`)
    .join(" OR ");
  return `${query} (${restrictions})`;
}

function isOfficialUrl(url: string, officialDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    return officialDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function discoveryId(input: {
  providerSearchId: string;
  rank: number;
  url: string;
}): string {
  return `discovery-${stableDigest(
    "claustrace:serpapi-discovery:v1",
    input as unknown as JsonValue,
  ).slice(0, 20)}`;
}

export class SerpApiSearchProvider implements SearchProvider {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #now: () => Date;

  constructor(options: SerpApiProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new SafeProviderError({
        code: "provider_not_configured",
        provider: "serpapi",
        message: "SerpApi is not configured on the trusted server.",
      });
    }
    this.#apiKey = apiKey;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => new Date());
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const intent = normalizeSearchIntent(request.query, request.officialDomains);
    if (!intent.query || intent.query.length > 500) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "serpapi",
        message: "SerpApi query must contain between 1 and 500 characters.",
      });
    }
    const officialDomains = validatedOfficialDomains(intent.officialDomains);
    const normalizedQuery = buildRestrictedSearchQuery(
      intent.query,
      officialDomains,
    );
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", normalizedQuery);
    url.searchParams.set("api_key", this.#apiKey);
    url.searchParams.set("output", "json");

    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
      });
    } catch {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "serpapi",
        message: "SerpApi request could not be completed.",
      });
    }

    if (!response.ok) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "serpapi",
        message: `SerpApi rejected the request with HTTP ${response.status}.`,
        httpStatus: response.status,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SafeProviderError({
        code: "provider_response_invalid",
        provider: "serpapi",
        message: "SerpApi returned a non-JSON response.",
      });
    }

    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success || parsed.data.error) {
      throw new SafeProviderError({
        code: parsed.success
          ? "provider_request_rejected"
          : "provider_response_invalid",
        provider: "serpapi",
        message: parsed.success
          ? "SerpApi reported a provider-side error."
          : "SerpApi returned an unexpected response shape.",
      });
    }

    const metadata = parsed.data.search_metadata;
    if (!metadata || metadata.status !== "Success") {
      throw new SafeProviderError({
        code: "provider_response_invalid",
        provider: "serpapi",
        message: "SerpApi did not return a completed search.",
      });
    }

    const retrievedAt = this.#now().toISOString();
    const results: SearchDiscovery[] = (parsed.data.organic_results ?? [])
      .filter(
        (item): item is typeof item & { title: string; link: string } =>
          Boolean(item.title && item.link),
      )
      .map((item, index) => {
        const rank = item.position ?? index + 1;
        return {
          id: discoveryId({
            providerSearchId: metadata.id,
            rank,
            url: item.link,
          }),
          provider: "serpapi",
          providerSearchId: metadata.id,
          providerStatus: "success",
          normalizedQuery,
          rank,
          title: item.title,
          url: item.link,
          snippet: item.snippet ?? "",
          retrievedAt,
          officialDomain: isOfficialUrl(item.link, officialDomains),
          state: "discovered",
        };
      });

    return {
      provider: "serpapi",
      providerSearchId: metadata.id,
      status: "success",
      results,
      receivedAt: retrievedAt,
    };
  }
}
