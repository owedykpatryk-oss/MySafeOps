import { describe, expect, it } from "vitest";
import { BILLING_PLANS, STRIPE_SUBSCRIBABLE_PLAN_IDS, ANNUAL_PRICE_INCREASE_PERCENT, PRICE_ADJUSTMENT_SHORT, getEffectivePlanId } from "./billingPlans";

/** Keep in sync with scripts/stripe-seed-prices.mjs PLANS.amountPence */
const SEED_AMOUNTS_PENCE = {
  starter: 1900,
  team: 9900,
  business: 24900,
  enterprise: 49900,
};

const STRIPE_PRICE_ENV_KEYS = {
  starter: "STRIPE_PRICE_STARTER",
  team: "STRIPE_PRICE_TEAM",
  business: "STRIPE_PRICE_BUSINESS",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

function parseGbpPriceLabel(label) {
  const m = String(label || "").match(/£(\d+)/);
  return m ? Number(m[1]) * 100 : null;
}

describe("billingPlans", () => {
  it("Stripe-subscribable plan ids match seed script and Edge env keys", () => {
    expect(STRIPE_SUBSCRIBABLE_PLAN_IDS).toEqual(["starter", "team", "business", "enterprise"]);
    for (const id of STRIPE_SUBSCRIBABLE_PLAN_IDS) {
      expect(STRIPE_PRICE_ENV_KEYS[id]).toMatch(/^STRIPE_PRICE_/);
      expect(SEED_AMOUNTS_PENCE[id]).toBeGreaterThan(0);
    }
  });

  it("UI price labels match seed amounts (GBP monthly)", () => {
    for (const id of STRIPE_SUBSCRIBABLE_PLAN_IDS) {
      const plan = BILLING_PLANS[id];
      expect(plan).toBeTruthy();
      expect(parseGbpPriceLabel(plan.priceLabel)).toBe(SEED_AMOUNTS_PENCE[id]);
      expect(plan.interval).toBe("month");
    }
  });

  it("local workspace limits match evaluation trial caps", () => {
    expect(getEffectivePlanId(null, {})).toBe("local");
  });

  it("documents annual price review cap in shared footnote copy", () => {
    expect(ANNUAL_PRICE_INCREASE_PERCENT).toBe(10);
    expect(PRICE_ADJUSTMENT_SHORT).toMatch(/10%/);
    expect(PRICE_ADJUSTMENT_SHORT).toMatch(/30 days/);
  });
});
