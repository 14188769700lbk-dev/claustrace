import type { ClauseTraceCase, ReviewEvent } from "../shared/types.js";
import { appendReviewEvent } from "../core/review-policy.js";

const DEMO_TIME = "2026-08-18T15:30:00.000Z";

export const demoCase: ClauseTraceCase = {
  id: "CT-DEMO-204",
  title: "Orders API field migration addendum",
  mode: "synthetic_fixture",
  state: "needs_review",
  documentUrl: "/synthetic-api-change-addendum.pdf",
  documentDigest:
    "sha256:56aedfc5d0df96b3b6632784aeb94702deb07d5bb11aefdeccadff44d6861cc7",
  officialDomainAllowlist: ["docs.northstar.invalid"],
  fields: [
    {
      id: "field-title",
      key: "documentTitle",
      label: "Document title",
      value: "Fictional API Data Change Addendum",
      required: true,
      confidence: 0.99,
      citations: [
        {
          page: 1,
          bounds: { left: 118, top: 92, right: 478, bottom: 121 },
          quote: "Fictional API Data Change Addendum",
        },
      ],
      provenance: "synthetic_fixture",
    },
    {
      id: "field-window",
      key: "compatibilityWindowDays",
      label: "Compatibility window",
      value: 45,
      required: true,
      confidence: 0.97,
      citations: [
        {
          page: 1,
          bounds: { left: 142, top: 300, right: 474, bottom: 338 },
          quote: "keep both fields readable for 45 calendar days",
        },
      ],
      provenance: "synthetic_fixture",
    },
    {
      id: "field-notice",
      key: "noticeDeadline",
      label: "Notice deadline",
      value: "14 calendar days before production enablement",
      required: true,
      confidence: 0.94,
      citations: [
        {
          page: 1,
          bounds: { left: 142, top: 351, right: 472, bottom: 388 },
          quote: "written notice at least 14 calendar days before enabling",
        },
      ],
      provenance: "synthetic_fixture",
    },
    {
      id: "field-owner",
      key: "approvalOwner",
      label: "Approval owner",
      value: "Customer Data Platform Owner",
      required: true,
      confidence: 0.93,
      citations: [
        {
          page: 1,
          bounds: { left: 142, top: 372, right: 478, bottom: 402 },
          quote: "Customer Data Platform Owner must record approval",
        },
      ],
      provenance: "synthetic_fixture",
    },
    {
      id: "field-rollback",
      key: "rollbackRequirement",
      label: "Rollback requirement",
      value: "Restore the previous response shape within 30 minutes",
      required: true,
      confidence: 0.96,
      citations: [
        {
          page: 1,
          bounds: { left: 142, top: 512, right: 479, bottom: 554 },
          quote: "tested rollback that restores the previous response shape within 30 minutes",
        },
      ],
      provenance: "synthetic_fixture",
    },
    {
      id: "field-receipt",
      key: "unresolvedTerms",
      label: "Receipt confirmation channel",
      value: null,
      required: true,
      confidence: 0.54,
      citations: [
        {
          page: 1,
          bounds: { left: 142, top: 667, right: 476, bottom: 704 },
          quote: "Customer confirms receipt is not defined",
        },
      ],
      provenance: "synthetic_fixture",
    },
  ],
  discoveries: [
    {
      id: "source-change-policy",
      provider: "serpapi",
      providerSearchId: "fixture-search-ct-204",
      providerStatus: "cached",
      normalizedQuery:
        "site:docs.northstar.invalid orders api deprecation notice policy",
      rank: 1,
      title: "Orders API deprecation policy - synthetic current source",
      url: "https://docs.northstar.invalid/orders/deprecation-policy",
      snippet:
        "Synthetic discovery snippet: current policy describes a 60-day compatibility period.",
      retrievedAt: DEMO_TIME,
      officialDomain: true,
      state: "discovered",
    },
    {
      id: "source-community-post",
      provider: "serpapi",
      providerSearchId: "fixture-search-ct-204",
      providerStatus: "cached",
      normalizedQuery:
        "site:docs.northstar.invalid orders api deprecation notice policy",
      rank: 2,
      title: "Community migration notes",
      url: "https://community.example.invalid/northstar-migration",
      snippet:
        "Synthetic third-party snippet with no authority over the fictional addendum.",
      retrievedAt: DEMO_TIME,
      officialDomain: false,
      state: "discovered",
    },
  ],
  reviewEvents: [],
  controls: [
    {
      id: "control-compatibility",
      category: "compatibility",
      title: "Dual-field compatibility",
      description:
        "Expose shipping_country and country_code together until the reviewed window ends.",
      sourceFieldIds: ["field-window", "field-receipt"],
      status: "blocked",
    },
    {
      id: "control-notice",
      category: "notice",
      title: "Recorded enablement notice",
      description:
        "Record written notice at least 14 calendar days before production enablement.",
      sourceFieldIds: ["field-notice"],
      status: "proposed",
    },
    {
      id: "control-rollback",
      category: "rollback",
      title: "Thirty-minute rollback",
      description:
        "Test restoration of the previous response shape and pause on the specified error-rate threshold.",
      sourceFieldIds: ["field-rollback"],
      status: "proposed",
    },
  ],
  unresolvedTerms: ["Customer confirms receipt"],
};

export function createFreshDemoCase(): ClauseTraceCase {
  return structuredClone(demoCase);
}

export function runDeterministicReview(
  input: ClauseTraceCase,
): ClauseTraceCase {
  const reviewedAt = "2026-08-18T15:45:00.000Z";
  let next = structuredClone(input);

  for (const field of next.fields.filter(
    (item) => item.required && item.id !== "field-receipt",
  )) {
    const event: ReviewEvent = {
      id: `review-${field.id}`,
      action: "accept_extraction",
      reviewerLabel: "Demo reviewer",
      timestamp: reviewedAt,
      fieldId: field.id,
      previousValue: field.value,
      newValue: field.value,
      note: "Accepted in the deterministic dry run.",
    };
    next = appendReviewEvent(next, event);
  }

  next = appendReviewEvent(next, {
    id: "review-source-change-policy",
    action: "review_source_contradicting",
    reviewerLabel: "Demo reviewer",
    timestamp: reviewedAt,
    discoveryId: "source-change-policy",
    note: "Opened synthetic official source conflicts with the 45-day document value.",
    sourceDigest:
      "sha256:239751adc5b9ad05f4da9a76b76ea965d83228bf0586d3a30c1494676bb48f2a",
  });

  return next;
}
