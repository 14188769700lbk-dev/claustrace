import { describe, expect, it, vi } from "vitest";

import {
  NutrientBuildProvider,
  NutrientExtractionProvider,
} from "./nutrient.js";
import { SafeProviderError } from "./provider-error.js";

const pdfBytes = new TextEncoder().encode("%PDF-1.7\nsynthetic-test-pdf");

describe("NutrientBuildProvider", () => {
  it("uses the documented multipart /build contract and validates PDF output", async () => {
    let capturedInput: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      capturedInput = input.toString();
      capturedInit = init;
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "x-request-id": "nutrient-request-7",
        },
      });
    }) as unknown as typeof fetch;
    const provider = new NutrientBuildProvider({
      apiKey: "test-credential-value",
      fetchImpl,
      now: () => new Date("2026-08-18T16:10:00.000Z"),
    });

    const result = await provider.buildPacket({
      html: "<!doctype html><h1>Synthetic packet</h1>",
      idempotencyKey: "packet-intent-1234567890",
    });

    expect(capturedInput).toBe("https://api.nutrient.io/build");
    expect(capturedInit?.method).toBe("POST");
    expect(new Headers(capturedInit?.headers).get("authorization")).toBe(
      "Bearer test-credential-value",
    );
    const form = capturedInit?.body as FormData;
    expect(form.get("instructions")).toBe(
      JSON.stringify({ parts: [{ html: "packet.html" }] }),
    );
    expect(form.get("packet.html")).toBeInstanceOf(Blob);
    expect(result).toMatchObject({
      provider: "nutrient",
      providerRequestId: "nutrient-request-7",
      receivedAt: "2026-08-18T16:10:00.000Z",
    });
    expect(result.pdfBytes).toEqual(pdfBytes);
  });

  it("never includes the credential or response body in a rejected error", async () => {
    const credential = "credential-must-never-appear";
    const provider = new NutrientBuildProvider({
      apiKey: credential,
      fetchImpl: vi.fn(async () =>
        new Response(`rejected ${credential}`, { status: 403 }),
      ) as unknown as typeof fetch,
    });

    let caught: unknown;
    try {
      await provider.buildPacket({
        html: "<p>synthetic</p>",
        idempotencyKey: "packet-key",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SafeProviderError);
    expect((caught as Error).message).toBe(
      "Nutrient DWS rejected the request with HTTP 403.",
    );
    expect((caught as Error).message).not.toContain(credential);
  });

  it("rejects non-PDF output even when the HTTP request succeeds", async () => {
    const provider = new NutrientBuildProvider({
      apiKey: "test-value",
      fetchImpl: vi.fn(async () =>
        new Response("not a pdf", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      ) as unknown as typeof fetch,
    });

    await expect(
      provider.buildPacket({
        html: "<p>synthetic</p>",
        idempotencyKey: "packet-key",
      }),
    ).rejects.toMatchObject({ code: "provider_response_invalid" });
  });

});

describe("NutrientExtractionProvider", () => {
  const schema = {
    type: "object",
    properties: {
      documentTitle: {
        type: "string",
        title: "Document title",
      },
      compatibilityWindowDays: {
        type: "integer",
        title: "Compatibility window",
      },
    },
    required: ["documentTitle", "compatibilityWindowDays"],
  };

  it("uses the documented /extraction/extract multipart contract", async () => {
    let capturedInput: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      capturedInput = input.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: 200,
          requestId: "extract-request-9",
          output: {
            data: {
              documentTitle: "Synthetic API Addendum",
              compatibilityWindowDays: 45,
            },
            metadata: {
              documentTitle: {
                bbox: { x: 10, y: 20, width: 100, height: 12 },
                match: "id_match",
                confidence: 0.93,
                pageNumber: 1,
                source_bboxes: [
                  {
                    bbox: { x: 10, y: 20, width: 100, height: 12 },
                    block_id: "block-1",
                    pageNumber: 1,
                  },
                ],
              },
              compatibilityWindowDays: {
                match: "not_found",
              },
            },
            pages: [{ page: 1, width: 1200, height: 1697 }],
          },
          metrics: { pagesProcessed: 1 },
          usage: {
            data_extraction_credits: { cost: 7, remainingCredits: 835 },
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as unknown as typeof fetch;
    const provider = new NutrientExtractionProvider({
      apiKey: "test-extraction-credential",
      fetchImpl,
      now: () => new Date("2026-08-18T16:30:00.000Z"),
    });

    const result = await provider.extract({
      documentBytes: pdfBytes,
      documentDigest: "sha256:test-document",
      schema,
      idempotencyKey: "extract-intent-123456",
    });

    expect(capturedInput).toBe(
      "https://api.nutrient.io/extraction/extract",
    );
    expect(new Headers(capturedInit?.headers).get("authorization")).toBe(
      "Bearer test-extraction-credential",
    );
    const form = capturedInit?.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(JSON.parse(String(form.get("instructions")))).toEqual({
      schema: {
        ...schema,
        properties: {
          documentTitle: {
            type: "string",
          },
          compatibilityWindowDays: {
            type: "integer",
          },
        },
      },
      parseConfig: { mode: "structure" },
      options: { includeCitations: true },
    });
    expect(result).toMatchObject({
      provider: "nutrient",
      providerRequestId: "extract-request-9",
      receivedAt: "2026-08-18T16:30:00.000Z",
      usage: {
        creditsCost: 7,
        remainingCredits: 835,
        pagesProcessed: 1,
      },
    });
    expect(result.fields[0]).toMatchObject({
      key: "documentTitle",
      label: "Document title",
      value: "Synthetic API Addendum",
      required: true,
      confidence: 0.93,
      provenance: "nutrient",
      citations: [
        {
          grounding: "nutrient_bbox",
          match: "id_match",
          page: 1,
          bounds: { left: 10, top: 20, right: 110, bottom: 32 },
          sourceBlockId: "block-1",
        },
      ],
    });
    expect(result.fields[1].confidence).toBeUndefined();
    expect(result.fields[1].citations).toEqual([]);
  });

  it("rejects unsupported schema fields before spending provider credits", async () => {
    const providerFetch = vi.fn();
    const provider = new NutrientExtractionProvider({
      apiKey: "test-value",
      fetchImpl: providerFetch,
    });

    await expect(
      provider.extract({
        documentBytes: pdfBytes,
        documentDigest: "sha256:test-document",
        schema: {
          type: "object",
          properties: { inventedField: { type: "string" } },
        },
        idempotencyKey: "extract-key",
      }),
    ).rejects.toMatchObject({ code: "provider_request_rejected" });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("redacts extraction credentials and provider error bodies", async () => {
    const credential = "extraction-credential-must-not-appear";
    const provider = new NutrientExtractionProvider({
      apiKey: credential,
      fetchImpl: vi.fn(async () =>
        new Response(`rejected ${credential}`, { status: 403 }),
      ) as unknown as typeof fetch,
    });

    let caught: unknown;
    try {
      await provider.extract({
        documentBytes: pdfBytes,
        documentDigest: "sha256:test-document",
        schema,
        idempotencyKey: "extract-key",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SafeProviderError);
    expect((caught as Error).message).toBe(
      "Nutrient extraction rejected the request with HTTP 403.",
    );
    expect((caught as Error).message).not.toContain(credential);
  });
});
