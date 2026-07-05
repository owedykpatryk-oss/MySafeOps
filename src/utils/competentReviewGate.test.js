import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  COMPETENT_REVIEW_LABEL,
  gateCompetentReview,
  requiresCompetentReviewForPermitAction,
  requiresCompetentReviewForRamsStatus,
  stampCompetentReview,
} from "./competentReviewGate";

describe("competentReviewGate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires review for RAMS approved and issued", () => {
    expect(requiresCompetentReviewForRamsStatus("approved")).toBe(true);
    expect(requiresCompetentReviewForRamsStatus("issued")).toBe(true);
    expect(requiresCompetentReviewForRamsStatus("draft")).toBe(false);
  });

  it("requires review for permit approve, activate and close", () => {
    expect(requiresCompetentReviewForPermitAction("approve")).toBe(true);
    expect(requiresCompetentReviewForPermitAction("activate")).toBe(true);
    expect(requiresCompetentReviewForPermitAction("close")).toBe(true);
  });

  it("stampCompetentReview adds acknowledgement fields", () => {
    const out = stampCompetentReview({ id: "1" }, { by: "Patryk" });
    expect(out.competentReviewAcknowledgedBy).toBe("Patryk");
    expect(out.competentReviewAcknowledgedAt).toMatch(/^\d{4}-/);
  });

  it("gateCompetentReview returns false when user cancels", () => {
    vi.stubGlobal("window", { confirm: vi.fn(() => false) });
    expect(gateCompetentReview("approve this RAMS")).toBe(false);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("competent person"));
  });
});
