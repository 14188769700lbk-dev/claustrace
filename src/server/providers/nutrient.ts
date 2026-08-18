import type {
  PacketBuilderProvider,
  PacketBuildRequest,
  PacketBuildResponse,
} from "./contracts.js";
import { SafeProviderError } from "./provider-error.js";

type FetchLike = typeof fetch;

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface NutrientBuildProviderOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

function startsWithPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

async function readBoundedPdf(response: Response): Promise<Uint8Array> {
  if (!response.body) {
    throw new SafeProviderError({
      code: "provider_response_invalid",
      provider: "nutrient",
      message: "Nutrient DWS returned an empty PDF response.",
    });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PDF_BYTES) {
      await reader.cancel();
      throw new SafeProviderError({
        code: "provider_response_invalid",
        provider: "nutrient",
        message: "Nutrient DWS returned a PDF larger than 20 MiB.",
      });
    }
    chunks.push(value);
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function safeProviderRequestId(
  response: Response,
  idempotencyKey: string,
): string {
  const candidate =
    response.headers.get("x-request-id") ??
    response.headers.get("x-nutrient-request-id");
  return candidate && /^[a-z0-9._:-]{1,128}$/i.test(candidate)
    ? candidate
    : `unreported-${idempotencyKey.slice(0, 16)}`;
}

export class NutrientBuildProvider implements PacketBuilderProvider {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #now: () => Date;

  constructor(options: NutrientBuildProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new SafeProviderError({
        code: "provider_not_configured",
        provider: "nutrient",
        message: "Nutrient DWS is not configured on the trusted server.",
      });
    }
    this.#apiKey = apiKey;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => new Date());
  }

  async buildPacket(request: PacketBuildRequest): Promise<PacketBuildResponse> {
    const htmlBytes = new TextEncoder().encode(request.html);
    if (htmlBytes.length === 0 || htmlBytes.length > MAX_HTML_BYTES) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message: "Nutrient packet HTML must contain between 1 byte and 2 MiB.",
      });
    }

    const form = new FormData();
    form.append(
      "packet.html",
      new Blob([htmlBytes], { type: "text/html; charset=utf-8" }),
      "packet.html",
    );
    form.append(
      "instructions",
      JSON.stringify({ parts: [{ html: "packet.html" }] }),
    );

    let response: Response;
    try {
      response = await this.#fetch("https://api.nutrient.io/build", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          accept: "application/pdf",
        },
        body: form,
      });
    } catch {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message: "Nutrient DWS request could not be completed.",
      });
    }

    if (!response.ok) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message: `Nutrient DWS rejected the request with HTTP ${response.status}.`,
        httpStatus: response.status,
      });
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (
      !contentType.includes("application/pdf") ||
      (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES)
    ) {
      throw new SafeProviderError({
        code: "provider_response_invalid",
        provider: "nutrient",
        message: "Nutrient DWS did not return an acceptable PDF response.",
      });
    }

    const pdfBytes = await readBoundedPdf(response);
    if (
      pdfBytes.length === 0 ||
      pdfBytes.length > MAX_PDF_BYTES ||
      !startsWithPdfHeader(pdfBytes)
    ) {
      throw new SafeProviderError({
        code: "provider_response_invalid",
        provider: "nutrient",
        message: "Nutrient DWS returned invalid PDF bytes.",
      });
    }

    const providerRequestId = safeProviderRequestId(
      response,
      request.idempotencyKey,
    );

    return {
      provider: "nutrient",
      providerRequestId,
      pdfBytes,
      receivedAt: this.#now().toISOString(),
    };
  }
}

/**
 * Nutrient advertises /extract, but its authenticated request contract and the
 * current DWS key's entitlement have not yet been verified. Keeping this
 * explicit prevents fixture coordinates from being mislabeled as live output.
 */
export function nutrientExtractionUnavailable(): never {
  throw new SafeProviderError({
    code: "provider_contract_unverified",
    provider: "nutrient",
    message:
      "Nutrient extraction remains disabled until its request contract and account entitlement are verified.",
  });
}
