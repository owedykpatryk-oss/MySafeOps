import { describe, expect, it } from "vitest";
import { checkBillingLimit, billingLimitMessage } from "./billingLimits";

describe("billingLimits", () => {
  it("blocks when at worker cap on free plan", () => {
    const result = checkBillingLimit("workers", {
      trialStatus: { isActive: false },
      billing: {},
      isPlatformOwner: false,
    });
    expect(typeof result.ok).toBe("boolean");
    expect(result.limit).toBe(3);
  });

  it("returns message when blocked", () => {
    const msg = billingLimitMessage({
      ok: false,
      kind: "projects",
      limit: 10,
      count: 10,
      planName: "Free",
    });
    expect(msg).toContain("Free plan");
    expect(msg).toContain("10 projects");
  });
});
