import { describe, expect, it } from "vitest";

import { createFreshDemoCase, runDeterministicReview } from "../fixtures/demo-case.js";
import type { ReviewEvent } from "../shared/types.js";
import {
  appendReviewEvent,
  canSeal,
  createDraftPacket,
  deriveReviewState,
  evaluateApproval,
} from "./review-policy.js";

describe("ClauseTrace review policy", () => {
  it("never treats a SerpApi snippet as verified evidence", () => {
    const record = createFreshDemoCase();
    expect(record.discoveries[0].state).toBe("discovered");
    expect(record.discoveries[0].sourceDigest).toBeUndefined();
    expect(record.discoveries[0].snippet).toContain("60-day");
  });

  it("requires a captured digest when a source is reviewed", () => {
    const record = createFreshDemoCase();
    const event: ReviewEvent = {
      id: "review-source",
      action: "review_source_supporting",
      reviewerLabel: "Test reviewer",
      timestamp: "2026-08-18T16:00:00.000Z",
      discoveryId: record.discoveries[0].id,
      sourceDigest: "sha256:test-source-digest",
    };
    const next = appendReviewEvent(record, event);

    expect(next.discoveries[0].state).toBe("reviewed_supporting");
    expect(next.discoveries[0].sourceDigest).toBe("sha256:test-source-digest");
  });

  it("blocks missing values, low confidence, and unreviewed required fields", () => {
    const blockers = evaluateApproval(createFreshDemoCase());
    expect(blockers.some((item) => item.code === "missing_value")).toBe(true);
    expect(blockers.some((item) => item.code === "low_confidence")).toBe(true);
    expect(blockers.some((item) => item.code === "unreviewed_field")).toBe(true);
  });

  it("keeps a reviewed contradiction open", () => {
    const reviewed = runDeterministicReview(createFreshDemoCase());
    const blockers = evaluateApproval(reviewed);

    expect(reviewed.state).toBe("reviewed_with_open_items");
    expect(
      blockers.some((item) => item.code === "unresolved_contradiction"),
    ).toBe(true);
  });

  it("appends corrections without overwriting extraction evidence", () => {
    const record = createFreshDemoCase();
    const field = record.fields[1];
    const originalValue = field.value;
    const corrected = appendReviewEvent(record, {
      id: "correction-1",
      action: "correct_value",
      reviewerLabel: "Test reviewer",
      timestamp: "2026-08-18T16:00:00.000Z",
      fieldId: field.id,
      previousValue: originalValue,
      newValue: 60,
      note: "Correction remains a review event.",
    });

    expect(corrected.fields[1].value).toBe(originalValue);
    expect(corrected.reviewEvents).toHaveLength(1);
    expect(corrected.reviewEvents[0].previousValue).toBe(45);
    expect(corrected.reviewEvents[0].newValue).toBe(60);
  });

  it("generates a draft packet that preserves unresolved items", () => {
    const reviewed = runDeterministicReview(createFreshDemoCase());
    const withPacket = createDraftPacket(
      reviewed,
      "2026-08-18T16:05:00.000Z",
    );

    expect(withPacket.state).toBe("packet_generated");
    expect(withPacket.packet?.sealed).toBe(false);
    expect(withPacket.packet?.unresolvedItems.length).toBeGreaterThan(0);
    expect(withPacket.packet?.searchManifest[0].state).toBe(
      "reviewed_contradicting",
    );
  });

  it("derives needs_review for an untouched case", () => {
    expect(deriveReviewState(createFreshDemoCase())).toBe("needs_review");
  });

  it("cannot seal from the public dry run even with the exact phrase", () => {
    const record = createDraftPacket(
      runDeterministicReview(createFreshDemoCase()),
      "2026-08-18T16:05:00.000Z",
    );
    expect(canSeal(record, `SEAL ${record.id}`)).toEqual({
      allowed: false,
      reason: "Public dry runs cannot call the signing provider.",
    });
  });
});
