import express, { type Response } from "express";
import { z } from "zod";

import {
  packetBuildIdempotencyKey,
  searchIdempotencyKey,
} from "../core/idempotency.js";
import { createFreshDemoCase } from "../fixtures/demo-case.js";
import { renderSyntheticPacketHtml } from "./packet-html.js";
import { NutrientBuildProvider } from "./providers/nutrient.js";
import { SafeProviderError } from "./providers/provider-error.js";
import { SerpApiSearchProvider } from "./providers/serpapi.js";

type FetchLike = typeof fetch;

const domainPattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const searchBodySchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    officialDomains: z.array(z.string().trim().regex(domainPattern)).max(8),
  })
  .strict();

const buildBodySchema = z
  .object({ confirm: z.literal("BUILD SYNTHETIC PACKET") })
  .strict();

export interface CreateAppOptions {
  environment?: Pick<
    NodeJS.ProcessEnv,
    "NUTRIENT_API_KEY" | "SERPAPI_API_KEY"
  >;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

function sendProviderError(response: Response, error: unknown): void {
  if (error instanceof SafeProviderError) {
    const status =
      error.code === "provider_not_configured"
        ? 503
        : error.code === "provider_contract_unverified"
          ? 501
          : 502;
    response.status(status).json({ error: error.code, message: error.message });
    return;
  }
  response.status(500).json({
    error: "internal_error",
    message: "The trusted server could not complete the provider operation.",
  });
}

export function createApp(options: CreateAppOptions = {}) {
  const environment = options.environment ?? process.env;
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      mode: "trusted-server",
      providers: {
        nutrientBuildConfigured: Boolean(environment.NUTRIENT_API_KEY?.trim()),
        nutrientExtractionAvailable: false,
        serpApiConfigured: Boolean(environment.SERPAPI_API_KEY?.trim()),
      },
      boundary:
        "Presence booleans only. Nutrient extraction is disabled until its contract and entitlement are verified.",
    });
  });

  app.get("/api/demo", (_request, response) => {
    response.json(createFreshDemoCase());
  });

  app.post("/api/live/search", async (request, response) => {
    const body = searchBodySchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({
        error: "invalid_request",
        message: "Provide a query and up to eight valid official domains.",
      });
      return;
    }

    try {
      const provider = new SerpApiSearchProvider({
        apiKey: environment.SERPAPI_API_KEY ?? "",
        fetchImpl: options.fetchImpl,
        now: options.now,
      });
      const result = await provider.search({
        ...body.data,
        idempotencyKey: searchIdempotencyKey(
          body.data.query,
          body.data.officialDomains,
        ),
      });
      response.json(result);
    } catch (error) {
      sendProviderError(response, error);
    }
  });

  app.post("/api/live/build-synthetic-packet", async (request, response) => {
    const body = buildBodySchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({
        error: "confirmation_required",
        message: "Exact synthetic-build confirmation is required.",
      });
      return;
    }

    try {
      const provider = new NutrientBuildProvider({
        apiKey: environment.NUTRIENT_API_KEY ?? "",
        fetchImpl: options.fetchImpl,
        now: options.now,
      });
      const html = renderSyntheticPacketHtml(createFreshDemoCase());
      const result = await provider.buildPacket({
        html,
        idempotencyKey: packetBuildIdempotencyKey(html),
      });
      response
        .status(200)
        .set({
          "content-type": "application/pdf",
          "content-disposition":
            'inline; filename="claustrace-synthetic-evidence-snapshot.pdf"',
          "cache-control": "no-store",
          "x-claustrace-provider-request-id": result.providerRequestId,
        })
        .send(Buffer.from(result.pdfBytes));
    } catch (error) {
      sendProviderError(response, error);
    }
  });

  app.post("/api/live/extract", (_request, response) => {
    response.status(501).json({
      error: "provider_contract_unverified",
      message:
        "Nutrient extraction remains disabled until its request contract and account entitlement are verified.",
    });
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: "route_not_available",
      message: "The requested API route is not available.",
    });
  });

  return app;
}
