import { z } from "zod";

import {
  fieldKeys,
  type ExtractedField,
  type ExtractionCitation,
  type FieldKey,
  type JsonValue,
} from "../../shared/types.js";
import type {
  ExtractionRequest,
  ExtractionResponse,
  ExtractorProvider,
  PacketBuilderProvider,
  PacketBuildRequest,
  PacketBuildResponse,
} from "./contracts.js";
import { SafeProviderError } from "./provider-error.js";

type FetchLike = typeof fetch;

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTION_RESPONSE_BYTES = 8 * 1024 * 1024;

const extractionSchemaSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(
      z.string(),
      z
        .object({
          title: z.string().min(1).optional(),
          description: z.string().min(1).optional(),
        })
        .passthrough(),
    ),
    required: z.array(z.string()).optional(),
  })
  .passthrough();

const bboxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const matchSchema = z.enum([
  "id_match",
  "id_match_multiblock",
  "id_match_partial",
  "fuzzy_match",
  "not_found",
]);

const citationNodeSchema = z
  .object({
    bbox: bboxSchema.optional(),
    match: matchSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    pageNumber: z.number().int().positive().optional(),
    source_bboxes: z
      .array(
        z.object({
          bbox: bboxSchema,
          block_id: z.string().min(1).optional(),
          pageNumber: z.number().int().positive().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

const extractionResponseSchema = z
  .object({
    status: z.number().int(),
    requestId: z.string().min(1),
    output: z.object({
      data: z.record(z.string(), z.unknown()),
      metadata: z.unknown().optional(),
      pages: z
        .array(
          z
            .object({
              page: z.number().int().positive(),
              width: z.number().positive().optional(),
              height: z.number().positive().optional(),
            })
            .passthrough(),
        )
        .optional(),
    }),
    metrics: z
      .object({
        pagesProcessed: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
    usage: z
      .object({
        data_extraction_credits: z.object({
          cost: z.number().nonnegative(),
          remainingCredits: z.number().nonnegative(),
        }),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type CitationNode = z.infer<typeof citationNodeSchema>;
type ExtractParseMode = "structure" | "understand" | "agentic";

export interface NutrientBuildProviderOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

export interface NutrientExtractionProviderOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
  parseMode?: ExtractParseMode;
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

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

function hasCitationShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["bbox", "match", "confidence", "pageNumber", "source_bboxes"].some(
    (key) => key in value,
  );
}

function collectCitationNodes(value: unknown): CitationNode[] {
  if (hasCitationShape(value)) {
    const parsed = citationNodeSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  }
  if (Array.isArray(value)) return value.flatMap(collectCitationNodes);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectCitationNodes);
  }
  return [];
}

function citationBounds(bbox: z.infer<typeof bboxSchema>) {
  return {
    left: bbox.x,
    top: bbox.y,
    right: bbox.x + bbox.width,
    bottom: bbox.y + bbox.height,
  };
}

function mapCitations(nodes: CitationNode[]): ExtractionCitation[] {
  const citations: ExtractionCitation[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (node.match === "not_found") continue;
    const sources =
      node.source_bboxes && node.source_bboxes.length > 0
        ? node.source_bboxes.map((source) => ({
            bbox: source.bbox,
            page: source.pageNumber ?? node.pageNumber,
            blockId: source.block_id,
          }))
        : node.bbox
          ? [{ bbox: node.bbox, page: node.pageNumber, blockId: undefined }]
          : [];

    for (const source of sources) {
      if (!source.page) continue;
      const bounds = citationBounds(source.bbox);
      const key = `${source.page}:${bounds.left}:${bounds.top}:${bounds.right}:${bounds.bottom}:${source.blockId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push({
        page: source.page,
        bounds,
        grounding: "nutrient_bbox",
        match: node.match,
        sourceBlockId: source.blockId,
      });
    }
  }
  return citations;
}

function humanizeFieldKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function providerCompatibleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerCompatibleSchema);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "title")
        .map(([key, item]) => [key, providerCompatibleSchema(item)]),
    );
  }
  return value;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_EXTRACTION_RESPONSE_BYTES
  ) {
    throw new SafeProviderError({
      code: "provider_response_invalid",
      provider: "nutrient",
      message: "Nutrient extraction returned a response larger than 8 MiB.",
    });
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_EXTRACTION_RESPONSE_BYTES) {
    throw new SafeProviderError({
      code: "provider_response_invalid",
      provider: "nutrient",
      message: "Nutrient extraction returned a response larger than 8 MiB.",
    });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SafeProviderError({
      code: "provider_response_invalid",
      provider: "nutrient",
      message: "Nutrient extraction returned a non-JSON response.",
    });
  }
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

export class NutrientExtractionProvider implements ExtractorProvider {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #now: () => Date;
  readonly #parseMode: ExtractParseMode;

  constructor(options: NutrientExtractionProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new SafeProviderError({
        code: "provider_not_configured",
        provider: "nutrient",
        message:
          "Nutrient Data Extraction is not configured on the trusted server.",
      });
    }
    this.#apiKey = apiKey;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => new Date());
    this.#parseMode = options.parseMode ?? "structure";
  }

  async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    if (
      request.documentBytes.length < 5 ||
      request.documentBytes.length > MAX_PDF_BYTES ||
      !startsWithPdfHeader(request.documentBytes)
    ) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message: "Nutrient extraction accepts a PDF up to 20 MiB in ClauseTrace.",
      });
    }

    const parsedSchema = extractionSchemaSchema.safeParse(request.schema);
    if (!parsedSchema.success) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message:
          "Nutrient extraction requires an object JSON Schema with properties.",
      });
    }
    const propertyKeys = Object.keys(parsedSchema.data.properties);
    if (
      propertyKeys.length === 0 ||
      propertyKeys.some((key) => !fieldKeys.includes(key as FieldKey))
    ) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message:
          "Nutrient extraction schema contains no fields or unsupported ClauseTrace fields.",
      });
    }

    const form = new FormData();
    const pdfArrayBuffer = Uint8Array.from(request.documentBytes).buffer;
    form.append(
      "file",
      new Blob([pdfArrayBuffer], { type: "application/pdf" }),
      "claustrace-document.pdf",
    );
    form.append(
      "instructions",
      JSON.stringify({
        schema: providerCompatibleSchema(request.schema),
        parseConfig: { mode: this.#parseMode },
        options: { includeCitations: true },
      }),
    );

    let response: Response;
    try {
      response = await this.#fetch(
        "https://api.nutrient.io/extraction/extract",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.#apiKey}`,
            accept: "application/json",
          },
          body: form,
        },
      );
    } catch {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message: "Nutrient extraction request could not be completed.",
      });
    }

    if (!response.ok) {
      throw new SafeProviderError({
        code: "provider_request_rejected",
        provider: "nutrient",
        message: `Nutrient extraction rejected the request with HTTP ${response.status}.`,
        httpStatus: response.status,
      });
    }
    if (
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json")
    ) {
      throw new SafeProviderError({
        code: "provider_response_invalid",
        provider: "nutrient",
        message: "Nutrient extraction did not return JSON.",
      });
    }

    const payload = extractionResponseSchema.safeParse(
      await readBoundedJson(response),
    );
    if (!payload.success || payload.data.status !== 200) {
      throw new SafeProviderError({
        code: "provider_response_invalid",
        provider: "nutrient",
        message: "Nutrient extraction returned an unexpected response shape.",
      });
    }

    const required = new Set(parsedSchema.data.required ?? []);
    const metadataRoot =
      payload.data.output.metadata &&
      typeof payload.data.output.metadata === "object" &&
      !Array.isArray(payload.data.output.metadata)
        ? (payload.data.output.metadata as Record<string, unknown>)
        : {};
    const fields: ExtractedField[] = propertyKeys.map((key) => {
      const value = payload.data.output.data[key];
      if (value !== undefined && !isJsonValue(value)) {
        throw new SafeProviderError({
          code: "provider_response_invalid",
          provider: "nutrient",
          message: "Nutrient extraction returned a non-JSON field value.",
        });
      }
      const nodes = collectCitationNodes(metadataRoot[key]);
      const confidenceScores = nodes
        .map((node) => node.confidence)
        .filter((score): score is number => score !== undefined);
      const property = parsedSchema.data.properties[key];
      return {
        id: `nutrient-${request.idempotencyKey.slice(0, 12)}-${key}`,
        key: key as FieldKey,
        label: property.title ?? humanizeFieldKey(key),
        value: value === undefined ? null : value,
        required: required.has(key),
        confidence:
          confidenceScores.length > 0
            ? Math.min(...confidenceScores)
            : undefined,
        citations: mapCitations(nodes),
        provenance: "nutrient",
      };
    });

    return {
      provider: "nutrient",
      providerRequestId: /^[a-z0-9._:-]{1,128}$/i.test(
        payload.data.requestId,
      )
        ? payload.data.requestId
        : `unreported-${request.idempotencyKey.slice(0, 16)}`,
      fields,
      receivedAt: this.#now().toISOString(),
      usage: payload.data.usage
        ? {
            creditsCost: payload.data.usage.data_extraction_credits.cost,
            remainingCredits:
              payload.data.usage.data_extraction_credits.remainingCredits,
            pagesProcessed: payload.data.metrics?.pagesProcessed,
          }
        : undefined,
    };
  }
}
