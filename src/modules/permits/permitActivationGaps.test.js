import { describe, it, expect } from "vitest";
import { buildPermitActivationGaps } from "./permitActivationGaps.js";

describe("buildPermitActivationGaps", () => {
  it("lists issuer signature when review blocked", () => {
    const gaps = buildPermitActivationGaps({
      derivedStatus: "pending_review",
      approveGate: { allowed: false, code: "issuer_signature" },
    });
    expect(gaps.some((g) => g.id === "issuer_sign")).toBe(true);
  });

  it("lists signatures and checklist gaps for activation", () => {
    const gaps = buildPermitActivationGaps({
      derivedStatus: "approved",
      activateGate: { allowed: false, code: "signatures", unsignedRoles: ["receiver"] },
      checkedCount: 1,
      totalChecks: 4,
    });
    expect(gaps.some((g) => g.id === "signatures")).toBe(true);
    expect(gaps.some((g) => g.id === "checklist")).toBe(true);
  });

  it("caps at five items", () => {
    const gaps = buildPermitActivationGaps({
      derivedStatus: "approved",
      activateGate: { allowed: false, code: "signatures" },
      checkedCount: 0,
      totalChecks: 4,
      briefingPending: true,
      ramsMissing: true,
      handoverState: { required: true, missing: true },
    });
    expect(gaps.length).toBeLessThanOrEqual(5);
  });
});
