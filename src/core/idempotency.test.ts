import { describe, expect, it } from "vitest";

import {
  extractionIdempotencyKey,
  normalizeSearchIntent,
  packetBuildIdempotencyKey,
  searchIdempotencyKey,
} from "./idempotency.js";

describe("stable provider intent digests", () => {
  it("is stable across extraction schema key order", () => {
    const left = extractionIdempotencyKey("sha256:document", {
      title: "string",
      window: "integer",
    });
    const right = extractionIdempotencyKey("sha256:document", {
      window: "integer",
      title: "string",
    });
    expect(left).toBe(right);
  });

  it("normalizes search whitespace, domain case, duplicates, and order", () => {
    expect(
      normalizeSearchIntent("  orders   api policy ", [
        "WWW.Example.com",
        "docs.example.com",
        "example.com",
      ]),
    ).toEqual({
      query: "orders api policy",
      officialDomains: ["docs.example.com", "example.com"],
    });
  });

  it("produces a stable search key for equivalent intents", () => {
    expect(
      searchIdempotencyKey("orders  api policy", [
        "example.com",
        "docs.example.com",
      ]),
    ).toBe(
      searchIdempotencyKey(" orders api policy ", [
        "DOCS.EXAMPLE.COM",
        "www.example.com",
      ]),
    );
  });

  it("changes packet keys when the packet HTML changes", () => {
    expect(packetBuildIdempotencyKey("<p>one</p>")).not.toBe(
      packetBuildIdempotencyKey("<p>two</p>"),
    );
  });
});
