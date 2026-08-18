import type {
  ClauseTraceCase,
  EvidencePacket,
  JsonValue,
  PolicyBlocker,
  ReviewEvent,
  ReviewState,
  SearchDiscovery,
} from "../shared/types.js";

export const MIN_REQUIRED_CONFIDENCE = 0.8;

function hasValue(value: JsonValue): boolean {
  if (value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function hasUsableCitation(field: ClauseTraceCase["fields"][number]): boolean {
  return field.citations.some(
    (citation) =>
      citation.page > 0 &&
      (citation.grounding === "nutrient_bbox"
        ? citation.match !== "not_found"
        : Boolean(citation.quote?.trim())) &&
      citation.bounds.right > citation.bounds.left &&
      citation.bounds.bottom > citation.bounds.top,
  );
}

function latestEventForField(
  events: ReviewEvent[],
  fieldId: string,
): ReviewEvent | undefined {
  return [...events].reverse().find((event) => event.fieldId === fieldId);
}

function contradictionResolved(
  discovery: SearchDiscovery,
  events: ReviewEvent[],
): boolean {
  return events.some(
    (event) =>
      event.discoveryId === discovery.id &&
      event.action === "resolve_contradiction" &&
      Boolean(event.sourceDigest),
  );
}

export function evaluateApproval(caseRecord: ClauseTraceCase): PolicyBlocker[] {
  const blockers: PolicyBlocker[] = [];

  for (const field of caseRecord.fields.filter((item) => item.required)) {
    if (!hasValue(field.value)) {
      blockers.push({
        code: "missing_value",
        fieldId: field.id,
        message: `${field.label} has no extracted value.`,
      });
    }

    if (!hasUsableCitation(field)) {
      blockers.push({
        code: "missing_citation",
        fieldId: field.id,
        message: `${field.label} has no provider-backed page citation.`,
      });
    }

    if (
      field.confidence !== undefined &&
      field.confidence < MIN_REQUIRED_CONFIDENCE
    ) {
      blockers.push({
        code: "low_confidence",
        fieldId: field.id,
        message: `${field.label} confidence ${Math.round(field.confidence * 100)}% is below the ${Math.round(MIN_REQUIRED_CONFIDENCE * 100)}% gate.`,
      });
    }

    const latestEvent = latestEventForField(caseRecord.reviewEvents, field.id);
    if (
      !latestEvent ||
      !["accept_extraction", "correct_value"].includes(latestEvent.action)
    ) {
      blockers.push({
        code: "unreviewed_field",
        fieldId: field.id,
        message: `${field.label} still requires an explicit reviewer decision.`,
      });
    }
  }

  for (const discovery of caseRecord.discoveries) {
    if (
      discovery.state === "reviewed_contradicting" &&
      !contradictionResolved(discovery, caseRecord.reviewEvents)
    ) {
      blockers.push({
        code: "unresolved_contradiction",
        discoveryId: discovery.id,
        message: `Reviewed source “${discovery.title}” contradicts the document and remains unresolved.`,
      });
    }
  }

  for (const term of caseRecord.unresolvedTerms) {
    const resolved = caseRecord.reviewEvents.some(
      (event) => event.action === "resolve_term" && event.note === term,
    );
    if (!resolved) {
      blockers.push({
        code: "unresolved_term",
        message: `Unresolved term: ${term}`,
      });
    }
  }

  return blockers;
}

export function deriveReviewState(caseRecord: ClauseTraceCase): ReviewState {
  if (caseRecord.packet) return "packet_generated";

  const blockers = evaluateApproval(caseRecord);
  if (blockers.length === 0) return "approved_for_packet";
  if (caseRecord.reviewEvents.length > 0) return "reviewed_with_open_items";
  return "needs_review";
}

export function appendReviewEvent(
  caseRecord: ClauseTraceCase,
  event: ReviewEvent,
): ClauseTraceCase {
  const discoveries = caseRecord.discoveries.map((discovery) => {
    if (discovery.id !== event.discoveryId) return discovery;

    if (event.action === "review_source_supporting") {
      return {
        ...discovery,
        state: "reviewed_supporting" as const,
        sourceDigest: event.sourceDigest,
      };
    }
    if (event.action === "review_source_contradicting") {
      return {
        ...discovery,
        state: "reviewed_contradicting" as const,
        sourceDigest: event.sourceDigest,
      };
    }
    return discovery;
  });

  const next: ClauseTraceCase = {
    ...caseRecord,
    discoveries,
    reviewEvents: [...caseRecord.reviewEvents, event],
  };
  return { ...next, state: deriveReviewState(next) };
}

export function createDraftPacket(
  caseRecord: ClauseTraceCase,
  generatedAt: string,
): ClauseTraceCase {
  const blockers = evaluateApproval(caseRecord);
  const acceptedFieldIds = caseRecord.reviewEvents
    .filter((event) => event.action === "accept_extraction" && event.fieldId)
    .map((event) => event.fieldId as string);
  const correctedFieldIds = caseRecord.reviewEvents
    .filter((event) => event.action === "correct_value" && event.fieldId)
    .map((event) => event.fieldId as string);

  const packet: EvidencePacket = {
    id: `packet-${caseRecord.id}`,
    generatedAt,
    mode: "synthetic_fixture",
    documentDigest: caseRecord.documentDigest,
    acceptedFieldIds,
    correctedFieldIds,
    proposedControlIds: caseRecord.controls.map((control) => control.id),
    unresolvedItems: blockers,
    searchManifest: caseRecord.discoveries.map((discovery) => ({
      providerSearchId: discovery.providerSearchId,
      normalizedQuery: discovery.normalizedQuery,
      rank: discovery.rank,
      url: discovery.url,
      snippet: discovery.snippet,
      retrievedAt: discovery.retrievedAt,
      state: discovery.state,
      sourceDigest: discovery.sourceDigest,
    })),
    sealed: false,
  };

  return {
    ...caseRecord,
    state: "packet_generated",
    packet,
  };
}

export function canSeal(
  caseRecord: ClauseTraceCase,
  confirmation: string,
): { allowed: boolean; reason: string } {
  if (caseRecord.mode !== "live_server") {
    return {
      allowed: false,
      reason: "Public dry runs cannot call the signing provider.",
    };
  }
  if (!caseRecord.packet) {
    return { allowed: false, reason: "Generate a packet first." };
  }
  if (confirmation !== `SEAL ${caseRecord.id}`) {
    return {
      allowed: false,
      reason: `Confirmation must exactly match SEAL ${caseRecord.id}.`,
    };
  }
  return { allowed: true, reason: "Exact live seal confirmation accepted." };
}
