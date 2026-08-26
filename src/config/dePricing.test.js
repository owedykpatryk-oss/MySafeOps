import { describe, expect, it } from "vitest";
import { DE_PLAN_PRICE_LABELS, stripeEnvKeyForDePlan } from "./dePricing";

describe("dePricing", () => {
  it("exposes EUR price labels", () => {
    expect(DE_PLAN_PRICE_LABELS.starter).toBe("22 €");
    expect(DE_PLAN_PRICE_LABELS.team).toBe("129 €");
  });

  it("uses _EUR suffix for Stripe env keys", () => {
    expect(stripeEnvKeyForDePlan("team")).toBe("STRIPE_PRICE_TEAM_EUR");
    expect(stripeEnvKeyForDePlan("starter", true)).toBe("STRIPE_PRICE_STARTER_TEST_EUR");
  });
});
