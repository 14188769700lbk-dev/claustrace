import { createHash } from "node:crypto";

import type { JsonValue } from "../shared/types.js";

export function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(",")}}`;
}

export function stableDigest(namespace: string, value: JsonValue): string {
  return createHash("sha256")
    .update(`${namespace}\n${canonicalize(value)}`)
    .digest("hex");
}

export function extractionIdempotencyKey(
  documentDigest: string,
  extractionSchema: JsonValue,
): string {
  return stableDigest("claustrace:extract:v1", {
    documentDigest,
    extractionSchema,
  });
}

export function normalizeSearchIntent(
  query: string,
  officialDomains: string[],
): { query: string; officialDomains: string[] } {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const normalizedDomains = [
    ...new Set(
      officialDomains
        .map((domain) => domain.trim().toLowerCase().replace(/^www\./, ""))
        .filter(Boolean),
    ),
  ].sort();

  return {
    query: normalizedQuery,
    officialDomains: normalizedDomains,
  };
}

export function searchIdempotencyKey(
  query: string,
  officialDomains: string[],
): string {
  return stableDigest(
    "claustrace:search:v1",
    normalizeSearchIntent(query, officialDomains),
  );
}

export function packetBuildIdempotencyKey(html: string): string {
  return stableDigest("claustrace:packet-build:v1", { html });
}
