import type {
  ExtractedField,
  SearchDiscovery,
} from "../../shared/types.js";

export interface ExtractionRequest {
  documentBytes: Uint8Array;
  documentDigest: string;
  schema: Record<string, unknown>;
  idempotencyKey: string;
}

export interface ExtractionResponse {
  provider: "nutrient" | "fixture";
  providerRequestId: string;
  fields: ExtractedField[];
  receivedAt: string;
}

export interface SearchRequest {
  query: string;
  officialDomains: string[];
  idempotencyKey: string;
}

export interface SearchResponse {
  provider: "serpapi" | "fixture";
  providerSearchId: string;
  status: "success" | "cached";
  results: SearchDiscovery[];
  receivedAt: string;
}

export interface ExtractorProvider {
  extract(request: ExtractionRequest): Promise<ExtractionResponse>;
}

export interface SearchProvider {
  search(request: SearchRequest): Promise<SearchResponse>;
}

export interface PacketBuildRequest {
  html: string;
  idempotencyKey: string;
}

export interface PacketBuildResponse {
  provider: "nutrient";
  providerRequestId: string;
  pdfBytes: Uint8Array;
  receivedAt: string;
}

export interface PacketBuilderProvider {
  buildPacket(request: PacketBuildRequest): Promise<PacketBuildResponse>;
}
