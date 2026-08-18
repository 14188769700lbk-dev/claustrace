import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { demoCase } from "./demo-case.js";

describe("checked ClauseTrace fixture", () => {
  it("records the exact deterministic synthetic PDF digest", () => {
    const pdf = readFileSync(
      resolve("output/pdf/synthetic-api-change-addendum.pdf"),
    );
    const digest = `sha256:${createHash("sha256").update(pdf).digest("hex")}`;
    expect(digest).toBe(demoCase.documentDigest);
  });

  it("labels every bundled discovery as SerpApi-shaped fixture data", () => {
    expect(demoCase.discoveries).toHaveLength(2);
    expect(
      demoCase.discoveries.every(
        (discovery) =>
          discovery.provider === "serpapi" &&
          discovery.providerStatus === "cached" &&
          discovery.state === "discovered",
      ),
    ).toBe(true);
  });
});
