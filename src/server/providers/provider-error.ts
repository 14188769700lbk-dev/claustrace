export type ProviderErrorCode =
  | "provider_not_configured"
  | "provider_request_rejected"
  | "provider_response_invalid"
  | "provider_contract_unverified";

/**
 * A deliberately low-detail error safe to serialize or log.
 * Provider URLs, response bodies, and credentials never enter the message.
 */
export class SafeProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: "nutrient" | "serpapi";
  readonly httpStatus?: number;

  constructor(options: {
    code: ProviderErrorCode;
    provider: "nutrient" | "serpapi";
    message: string;
    httpStatus?: number;
  }) {
    super(options.message);
    this.name = "SafeProviderError";
    this.code = options.code;
    this.provider = options.provider;
    this.httpStatus = options.httpStatus;
  }
}
