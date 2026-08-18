import { createFreshDemoCase } from "../../fixtures/demo-case.js";
import type {
  ExtractionRequest,
  ExtractionResponse,
  ExtractorProvider,
  SearchProvider,
  SearchRequest,
  SearchResponse,
} from "./contracts.js";

export class FixtureExtractor implements ExtractorProvider {
  async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    const fixture = createFreshDemoCase();
    return {
      provider: "fixture",
      providerRequestId: `fixture-${request.idempotencyKey.slice(0, 12)}`,
      fields: fixture.fields,
      receivedAt: "2026-08-18T15:30:00.000Z",
    };
  }
}
export class FixtureSearchProvider implements SearchProvider {
  async search(request: SearchRequest): Promise<SearchResponse> {
    const fixture = createFreshDemoCase();
    return {
      provider: "fixture",
      providerSearchId: fixture.discoveries[0].providerSearchId,
      status: "cached",
      results: fixture.discoveries.map((result) => ({
        ...result,
        normalizedQuery: request.query,
      })),
      receivedAt: "2026-08-18T15:30:00.000Z",
    };
  }
}
