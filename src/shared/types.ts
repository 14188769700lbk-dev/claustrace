export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ReviewState =
  | "uploaded"
  | "extracting"
  | "needs_review"
  | "extraction_failed"
  | "reviewed_with_open_items"
  | "approved_for_packet"
  | "packet_generated"
  | "awaiting_seal_confirmation"
  | "sealed"
  | "sealing_failed";

export const fieldKeys = [
  "documentTitle",
  "parties",
  "effectiveDate",
  "affectedSystems",
  "affectedFields",
  "compatibilityWindowDays",
  "noticeDeadline",
  "retentionConstraint",
  "approvalOwner",
  "rollbackRequirement",
  "prohibitedActions",
  "unresolvedTerms",
] as const;

export type FieldKey = (typeof fieldKeys)[number];

export interface CitationBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ExtractionCitation {
  page: number;
  bounds: CitationBounds;
  grounding: "synthetic_quote" | "nutrient_bbox";
  quote?: string;
  match?:
    | "id_match"
    | "id_match_multiblock"
    | "id_match_partial"
    | "fuzzy_match"
    | "not_found";
  sourceBlockId?: string;
}

export interface ExtractedField {
  id: string;
  key: FieldKey;
  label: string;
  value: JsonValue;
  required: boolean;
  /** Relative provider score when present; never present it as a probability. */
  confidence?: number;
  citations: ExtractionCitation[];
  provenance: "synthetic_fixture" | "nutrient";
}

export type DiscoveryState =
  | "discovered"
  | "reviewed_supporting"
  | "reviewed_contradicting"
  | "dismissed";

export interface SearchDiscovery {
  id: string;
  provider: "serpapi";
  providerSearchId: string;
  providerStatus: "success" | "cached" | "error";
  normalizedQuery: string;
  rank: number;
  title: string;
  url: string;
  snippet: string;
  retrievedAt: string;
  officialDomain: boolean;
  state: DiscoveryState;
  sourceDigest?: string;
}

export type ReviewAction =
  | "accept_extraction"
  | "correct_value"
  | "reject_extraction"
  | "review_source_supporting"
  | "review_source_contradicting"
  | "resolve_contradiction"
  | "resolve_term";

export interface ReviewEvent {
  id: string;
  action: ReviewAction;
  reviewerLabel: string;
  timestamp: string;
  fieldId?: string;
  discoveryId?: string;
  previousValue?: JsonValue;
  newValue?: JsonValue;
  note?: string;
  sourceDigest?: string;
}

export interface EngineeringControl {
  id: string;
  category:
    | "compatibility"
    | "notice"
    | "retention"
    | "approval"
    | "rollback"
    | "prohibited_action";
  title: string;
  description: string;
  sourceFieldIds: string[];
  status: "proposed" | "accepted" | "blocked";
}

export interface PolicyBlocker {
  code:
    | "missing_value"
    | "missing_citation"
    | "low_confidence"
    | "unreviewed_field"
    | "unresolved_contradiction"
    | "unresolved_term";
  message: string;
  fieldId?: string;
  discoveryId?: string;
}

export interface EvidencePacket {
  id: string;
  generatedAt: string;
  mode: "synthetic_fixture" | "nutrient_dws";
  documentDigest: string;
  acceptedFieldIds: string[];
  correctedFieldIds: string[];
  proposedControlIds: string[];
  unresolvedItems: PolicyBlocker[];
  searchManifest: Array<
    Pick<
      SearchDiscovery,
      | "providerSearchId"
      | "normalizedQuery"
      | "rank"
      | "url"
      | "snippet"
      | "retrievedAt"
      | "state"
      | "sourceDigest"
    >
  >;
  sealed: boolean;
  sealValidation?: string;
}

export interface ClauseTraceCase {
  id: string;
  title: string;
  mode: "synthetic_fixture" | "live_server";
  state: ReviewState;
  documentUrl: string;
  documentDigest: string;
  officialDomainAllowlist: string[];
  fields: ExtractedField[];
  discoveries: SearchDiscovery[];
  reviewEvents: ReviewEvent[];
  controls: EngineeringControl[];
  unresolvedTerms: string[];
  packet?: EvidencePacket;
}
