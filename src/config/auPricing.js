/**
 * Australian list prices (AUD, ex GST). Single source for landing, billing UI, and Stripe seed scripts.
 * GST (10%) is added at Stripe checkout for AU customers when configured in Stripe Tax.
 */

/** @typedef {"starter"|"team"|"business"|"enterprise"} AuPaidPlanId */

/** Monthly amounts in cents (AUD). */
export const AU_PLAN_AMOUNT_CENTS = {
  starter: 5900,
  team: 22900,
  business: 57900,
  enterprise: 109900,
};

/** Human-readable monthly labels (ex GST). */
export const AU_PLAN_PRICE_LABELS = {
  starter: "A$59",
  team: "A$229",
  business: "A$579",
  enterprise: "A$1099",
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
  const testSuffix = testMode ? "_TEST" : "";
  return `${base}${AU_STRIPE_PRICE_ENV_SUFFIX}${testSuffix}`;
}
