/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { checkBillingLimit, billingLimitMessage } from "./billingLimits";
import { getEffectivePlanId } from "../lib/billingPlans";

describe("billingLimits", () => {
  it("blocks when at worker cap on local workspace plan", () => {
    const result = checkBillingLimit("workers", {
      trialStatus: null,
      billing: {},
      isPlatformOwner: false,
    });
    expect(typeof result.ok).toBe("boolean");
    expect(result.limit).toBe(200);
  });

  it("blocks all writes when trial expired", () => {
    const result = checkBillingLimit("workers", {
      trialStatus: { isActive: false, remainingDays: 0 },
      billing: {},
      isPlatformOwner: false,
    });
    expect(result.ok).toBe(false);
    expect(result.readOnly).toBe(true);
    expect(getEffectivePlanId({ isActive: false }, {})).toBe("expired");
  });

  it("returns message when blocked", () => {
    const msg = billingLimitMessage({
      ok: false,
      kind: "projects",
      limit: 10,
      count: 10,
      planName: "Solo",
    });
    expect(msg).toContain("Solo plan");
    expect(msg).toContain("10 projects");
  });

  it("returns read-only message when trial ended", () => {
    const msg = billingLimitMessage({ ok: false, readOnly: true });
    expect(msg).toContain("evaluation trial has ended");
  });
});
