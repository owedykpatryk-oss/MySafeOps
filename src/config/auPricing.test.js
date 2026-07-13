import { describe, expect, it } from "vitest";
import {
  AU_PLAN_AMOUNT_CENTS,
  AU_PLAN_PRICE_LABELS,
  getAuPlanAmountCents,
  getAuPlanPriceLabel,
  stripeEnvKeyForAuPlan,
} from "../config/auPricing";

describe("auPricing", () => {
  it("exposes AUD list prices ex GST", () => {
    expect(AU_PLAN_PRICE_LABELS.starter).toBe("A$59");
    expect(AU_PLAN_PRICE_LABELS.team).toBe("A$229");
    expect(AU_PLAN_PRICE_LABELS.business).toBe("A$579");
    expect(AU_PLAN_PRICE_LABELS.enterprise).toBe("A$1099");
  });

  it("maps plan ids to Stripe cents", () => {
    expect(getAuPlanAmountCents("starter")).toBe(AU_PLAN_AMOUNT_CENTS.starter);
    expect(getAuPlanPriceLabel("enterprise")).toBe("A$1099");
  });

  it("uses _AUD suffix for Stripe env keys", () => {
    expect(stripeEnvKeyForAuPlan("team")).toBe("STRIPE_PRICE_TEAM_AUD");
    expect(stripeEnvKeyForAuPlan("starter", true)).toBe("STRIPE_PRICE_STARTER_AUD_TEST");
  });
});
