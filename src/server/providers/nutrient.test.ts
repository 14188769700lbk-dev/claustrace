import { describe, expect, it, vi } from "vitest";

import {
  NutrientBuildProvider,
  nutrientExtractionUnavailable,
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

  it("keeps extraction fail-closed until the contract is verified", () => {
    expect(nutrientExtractionUnavailable).toThrowError(
      /request contract and account entitlement are verified/,
    );
  });
});
