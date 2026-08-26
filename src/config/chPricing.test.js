import { describe, expect, it } from "vitest";
import { CH_PLAN_PRICE_LABELS, stripeEnvKeyForChPlan, getChPlanAmountCents } from "./chPricing";

describe("chPricing", () => {
  it("uses CHF labels, not shared with DE/AT EUR", () => {
    expect(CH_PLAN_PRICE_LABELS.starter).toBe("25 CHF");
    expect(CH_PLAN_PRICE_LABELS.team).toBe("139 CHF");
  });

  it("uses its own _CHF Stripe env keys", () => {
    expect(stripeEnvKeyForChPlan("team")).toBe("STRIPE_PRICE_TEAM_CHF");
    expect(stripeEnvKeyForChPlan("team", true)).toBe("STRIPE_PRICE_TEAM_TEST_CHF");
  });

  it("returns amount in cents", () => {
    expect(getChPlanAmountCents("starter")).toBe(2500);
    expect(getChPlanAmountCents("enterprise")).toBe(82900);
  });
});
