import { describe, it, expect } from "vitest";
import { nextLegalReviewDate, LEGAL_GOVERNANCE } from "./permitLegalGovernance";

import { localDateISO } from "../../utils/localDate";
describe("permitLegalGovernance", () => {
  it("nextLegalReviewDate adds cadence days", () => {
    const fromIso = "2026-01-01T12:00:00.000Z";
    const next = nextLegalReviewDate(fromIso);
    const expectDt = new Date(fromIso);
    expectDt.setDate(expectDt.getDate() + LEGAL_GOVERNANCE.reviewCadenceDays);
    expect(next).toBe(localDateISO(expectDt));
  });
});
