/**
 * Swiss list prices (CHF, net of VAT). Own Stripe STRIPE_PRICE_*_CHF catalogue —
 * NOT shared with DE/AT EUR prices (different currency, different card networks).
 * MWST (Swiss VAT) is 8.1% as of 2024; confirm current rate before checkout copy changes.
 */

/** @typedef {"starter"|"team"|"business"|"enterprise"} ChPaidPlanId */

/** Monthly amounts in cents (CHF × 100). Slightly above EUR nominal — CH SaaS market norm. */
export const CH_PLAN_AMOUNT_CENTS = {
  starter: 2500,
  team: 13900,
  business: 39900,
  enterprise: 82900,
};

/** Human-readable monthly labels (net). */
export const CH_PLAN_PRICE_LABELS = {
  starter: "25 CHF",
  team: "139 CHF",
  business: "399 CHF",
  enterprise: "829 CHF",
  trial: "0 CHF",
};

export const CH_PRICING_FOOTNOTE = "Preise in CHF netto (ohne 8.1 % MWST).";

/** @param {ChPaidPlanId | "trial"} planId */
export function getChPlanPriceLabel(planId) {
  return CH_PLAN_PRICE_LABELS[planId] ?? "—";
}

/** @param {ChPaidPlanId} planId */
export function getChPlanAmountCents(planId) {
  return CH_PLAN_AMOUNT_CENTS[planId] ?? 0;
}

export const CH_STRIPE_PRICE_ENV_SUFFIX = "_CHF";

/** @param {ChPaidPlanId} planId @param {boolean} [testMode] */
export function stripeEnvKeyForChPlan(planId, testMode = false) {
  const base = {
    starter: "STRIPE_PRICE_STARTER",
    team: "STRIPE_PRICE_TEAM",
    business: "STRIPE_PRICE_BUSINESS",
    enterprise: "STRIPE_PRICE_ENTERPRISE",
  }[planId];
  const testInfix = testMode ? "_TEST" : "";
  return `${base}${testInfix}${CH_STRIPE_PRICE_ENV_SUFFIX}`;
}
