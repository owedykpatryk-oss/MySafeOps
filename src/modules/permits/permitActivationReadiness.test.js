import { describe, it, expect } from "vitest";
import { computePermitActivationReadiness } from "./permitActivationReadiness.js";

describe("computePermitActivationReadiness", () => {
  it("returns live for active permits", () => {
    const r = computePermitActivationReadiness({ derivedStatus: "active" });
    expect(r.score).toBe(100);
    expect(r.label).toBe("Live");
  });

  it("returns ready when gate allows", () => {
    const r = computePermitActivationReadiness({
      derivedStatus: "approved",
      activateGate: { allowed: true },
    });
    expect(r.score).toBe(100);
    expect(r.label).toBe("Ready");
  });

  it("returns partial score when blocked", () => {
    const r = computePermitActivationReadiness({
      derivedStatus: "approved",
      activateGate: { allowed: false },
      checkedCount: 2,
      totalChecks: 4,
    });
    expect(r.score).toBeLessThan(100);
    expect(r.show).toBe(true);
  });
});
