import { describe, expect, it, vi } from "vitest";

import type { SearchRequest } from "./contracts.js";
import { SafeProviderError } from "./provider-error.js";
import {
  buildRestrictedSearchQuery,
  SerpApiSearchProvider,
} from "./serpapi.js";

const request: SearchRequest = {
  query: " API   deprecation policy ",
  officialDomains: ["docs.example.com", "example.com"],
  idempotencyKey: "intent-123",
};

function successResponse() {
  return new Response(
    JSON.stringify({
      search_metadata: { id: "search-42", status: "Success" },
      organic_results: [
        {
          position: 2,
          title: "Official migration guide",
          link: "https://docs.example.com/api/migration",
          snippet: "Migrate before the compatibility window closes.",
        },
        {
          title: "Unrelated commentary",
          link: "https://example.net/commentary",
          snippet: "A third-party summary.",
        },
        { title: "Incomplete row without a URL" },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("SerpApiSearchProvider", () => {
  it("sends the documented Google parameters and maps results as discoveries", async () => {
    let capturedUrl: URL | undefined;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      capturedUrl = new URL(input.toString());
      return successResponse();
    }) as unknown as typeof fetch;
    const provider = new SerpApiSearchProvider({
      apiKey: "test-credential-value",
      fetchImpl,
      now: () => new Date("2026-08-18T16:00:00.000Z"),
    });

    const result = await provider.search(request);

    expect(capturedUrl).toBeDefined();
    expect(`${capturedUrl!.origin}${capturedUrl!.pathname}`).toBe(
      "https://serpapi.com/search",
    );
    expect(capturedUrl?.searchParams.get("engine")).toBe("google");
    expect(capturedUrl?.searchParams.get("api_key")).toBe(
      "test-credential-value",
    );
    expect(capturedUrl?.searchParams.get("q")).toBe(
      "API deprecation policy (site:docs.example.com OR site:example.com)",
    );
    expect(result).toMatchObject({
      provider: "serpapi",
      providerSearchId: "search-42",
      status: "success",
      receivedAt: "2026-08-18T16:00:00.000Z",
    });
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      rank: 2,
      officialDomain: true,
      state: "discovered",
      providerStatus: "success",
    });
    expect(result.results[1]).toMatchObject({
      rank: 2,
      officialDomain: false,
      state: "discovered",
    });
  });

  it("builds a deterministic restricted query", () => {
    expect(
      buildRestrictedSearchQuery("migration notice", [
        "docs.example.com",
        "status.example.com",
      ]),
    ).toBe(
      "migration notice (site:docs.example.com OR site:status.example.com)",
    );
  });

  it("does not treat lookalike domains as official", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          search_metadata: { id: "search-lookalike", status: "Success" },
          organic_results: [
            {
              title: "Lookalike",
              link: "https://docs.example.com.attacker.invalid/page",
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const provider = new SerpApiSearchProvider({
      apiKey: "test-value",
      fetchImpl,
    });

    const result = await provider.search({
      ...request,
      officialDomains: ["example.com"],
    });

    expect(result.results[0].officialDomain).toBe(false);
  });

  it("does not classify non-HTTP URLs as official sources", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          search_metadata: { id: "search-protocol", status: "Success" },
          organic_results: [
            {
              title: "FTP mirror",
              link: "ftp://example.com/notice",
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const provider = new SerpApiSearchProvider({
      apiKey: "test-value",
      fetchImpl,
    });

    const result = await provider.search({
      ...request,
      officialDomains: ["example.com"],
    });

    expect(result.results[0].officialDomain).toBe(false);
  });

  it("returns stable discovery ids for the same provider result", async () => {
    const provider = new SerpApiSearchProvider({
      apiKey: "test-value",
      fetchImpl: vi.fn(async () => successResponse()) as unknown as typeof fetch,
      now: () => new Date("2026-08-18T16:00:00.000Z"),
    });

    const first = await provider.search(request);
    const second = await provider.search(request);

    expect(first.results.map((item) => item.id)).toEqual(
      second.results.map((item) => item.id),
    );
  });

  it("redacts provider bodies and credentials from HTTP errors", async () => {
    const credential = "credential-must-never-appear";
    const provider = new SerpApiSearchProvider({
      apiKey: credential,
      fetchImpl: vi.fn(async () =>
        new Response(`rejected ${credential}`, { status: 401 }),
      ) as unknown as typeof fetch,
    });

    let caught: unknown;
    try {
      await provider.search(request);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SafeProviderError);
    expect((caught as Error).message).toBe(
      "SerpApi rejected the request with HTTP 401.",
    );
    expect((caught as Error).message).not.toContain(credential);
  });

  it("fails closed for invalid domains and incomplete provider status", async () => {
    const provider = new SerpApiSearchProvider({
      apiKey: "test-value",
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            search_metadata: { id: "pending", status: "Processing" },
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch,
    });

    await expect(
      provider.search({ ...request, officialDomains: ["https://example.com"] }),
    ).rejects.toMatchObject({ code: "provider_request_rejected" });
    await expect(provider.search(request)).rejects.toMatchObject({
      code: "provider_response_invalid",
    });
  });
});
