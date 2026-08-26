import { describe, expect, it } from "vitest";
import { AT_PLAN_PRICE_LABELS, stripeEnvKeyForAtPlan } from "./atPricing";

describe("atPricing", () => {
  it("reuses EUR labels shared with DE", () => {
    expect(AT_PLAN_PRICE_LABELS.starter).toBe("22 €");
    expect(AT_PLAN_PRICE_LABELS.team).toBe("129 €");
  });

  it("uses shared _EUR Stripe env keys", () => {
    expect(stripeEnvKeyForAtPlan("team")).toBe("STRIPE_PRICE_TEAM_EUR");
  });
});
