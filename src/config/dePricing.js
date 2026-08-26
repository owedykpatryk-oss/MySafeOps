/**
 * German list prices (EUR, net of VAT). Landing, billing UI, Stripe seed scripts.
 * VAT (19% MwSt) typically added at Stripe checkout when Stripe Tax is enabled for DE.
 */

/** @typedef {"starter"|"team"|"business"|"enterprise"} DePaidPlanId */

/** Monthly amounts in cents (EUR × 100). */
export const DE_PLAN_AMOUNT_CENTS = {
  starter: 2200,
  team: 12900,
  business: 35900,
  enterprise: 74900,
};

/** Human-readable monthly labels (net). */
export const DE_PLAN_PRICE_LABELS = {
  starter: "22 €",
  team: "129 €",
  business: "359 €",
  enterprise: "749 €",
  trial: "0 €",
};

export const DE_PRICING_FOOTNOTE = "Preise in EUR netto (ohne 19 % MwSt).";

/** @param {DePaidPlanId | "trial"} planId */
export function getDePlanPriceLabel(planId) {
  return DE_PLAN_PRICE_LABELS[planId] ?? "—";
}

/** @param {DePaidPlanId} planId */
export function getDePlanAmountCents(planId) {
  return DE_PLAN_AMOUNT_CENTS[planId] ?? 0;
}

export const DE_STRIPE_PRICE_ENV_SUFFIX = "_EUR";

/** @param {DePaidPlanId} planId @param {boolean} [testMode] */
export function stripeEnvKeyForDePlan(planId, testMode = false) {
  const base = {
    starter: "STRIPE_PRICE_STARTER",
    team: "STRIPE_PRICE_TEAM",
    business: "STRIPE_PRICE_BUSINESS",
    enterprise: "STRIPE_PRICE_ENTERPRISE",
  }[planId];
  const testInfix = testMode ? "_TEST" : "";
  return `${base}${testInfix}${DE_STRIPE_PRICE_ENV_SUFFIX}`;
}
