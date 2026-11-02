/**
 * Australian list prices (AUD, ex GST). Single source for landing, billing UI, and Stripe seed scripts.
 * GST (10%) is added at Stripe checkout for AU customers when configured in Stripe Tax.
 */

/** @typedef {"starter"|"team"|"business"|"enterprise"} AuPaidPlanId */

/** Monthly amounts in cents (AUD). */
export const AU_PLAN_AMOUNT_CENTS = {
  starter: 11900,
  team: 35900,
  business: 78900,
  enterprise: 153900,
};

/** Human-readable monthly labels (ex GST). */
export const AU_PLAN_PRICE_LABELS = {
  starter: "A$119",
  team: "A$359",
  business: "A$789",
  enterprise: "A$1539",
  trial: "A$0",
};

export const AU_PRICING_FOOTNOTE = "All prices in AUD, exclusive of GST (10%).";

/** @param {AuPaidPlanId | "trial"} planId */
export function getAuPlanPriceLabel(planId) {
  return AU_PLAN_PRICE_LABELS[planId] ?? "—";
}

/** @param {AuPaidPlanId} planId */
export function getAuPlanAmountCents(planId) {
  return AU_PLAN_AMOUNT_CENTS[planId] ?? 0;
}

/** Stripe env key suffix for AUD prices (e.g. STRIPE_PRICE_STARTER_AUD). */
export const AU_STRIPE_PRICE_ENV_SUFFIX = "_AUD";

/** @param {AuPaidPlanId} planId @param {boolean} [testMode] */
export function stripeEnvKeyForAuPlan(planId, testMode = false) {
  const base = {
    starter: "STRIPE_PRICE_STARTER",
    team: "STRIPE_PRICE_TEAM",
    business: "STRIPE_PRICE_BUSINESS",
    enterprise: "STRIPE_PRICE_ENTERPRISE",
  }[planId];
  const testInfix = testMode ? "_TEST" : "";
  return `${base}${testInfix}${AU_STRIPE_PRICE_ENV_SUFFIX}`;
}
