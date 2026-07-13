import { describe, expect, it } from "vitest";
import { PL_PLAN_PRICE_LABELS, stripeEnvKeyForPlPlan } from "./plPricing";

describe("plPricing", () => {
  it("exposes PLN price labels", () => {
    expect(PL_PLAN_PRICE_LABELS.starter).toBe("79 zł");
    expect(PL_PLAN_PRICE_LABELS.team).toBe("399 zł");
  });

  it("uses _PLN suffix for Stripe env keys", () => {
    expect(stripeEnvKeyForPlPlan("team")).toBe("STRIPE_PRICE_TEAM_PLN");
    expect(stripeEnvKeyForPlPlan("starter", true)).toBe("STRIPE_PRICE_STARTER_PLN_TEST");
  });
});
