import { describe, it, expect } from "vitest";
import { nextLegalReviewDate, LEGAL_GOVERNANCE, legalOwnerRole } from "./permitLegalGovernance";

import { localDateISO } from "../../utils/localDate";
describe("permitLegalGovernance", () => {
  it("nextLegalReviewDate adds cadence days", () => {
    const fromIso = "2026-01-01T12:00:00.000Z";
    const next = nextLegalReviewDate(fromIso);
    const expectDt = new Date(fromIso);
    expectDt.setDate(expectDt.getDate() + LEGAL_GOVERNANCE.reviewCadenceDays);
    expect(next).toBe(localDateISO(expectDt));
  });

  it("keeps HSE as the UK legal-content owner and uses PIP / WHS off UK", () => {
    expect(legalOwnerRole("uk")).toBe("HSE / Legal Reviewer");
    expect(LEGAL_GOVERNANCE.ownerRole).toBe("HSE / Legal Reviewer");
    expect(legalOwnerRole("pl")).toBe("PIP / recenzent prawny");
    expect(legalOwnerRole("pl")).not.toMatch(/HSE/);
    expect(legalOwnerRole("au")).toBe("WHS / Legal Reviewer");
    expect(legalOwnerRole("au")).not.toMatch(/HSE/);
  });
});
