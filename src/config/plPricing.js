/**
 * Polish list prices (PLN, net of VAT). Landing, billing UI, Stripe seed scripts.
 * VAT (23%) typically added at Stripe checkout when Stripe Tax is enabled for PL.
 */

/** @typedef {"starter"|"team"|"business"|"enterprise"} PlPaidPlanId */

/** Monthly amounts in grosze (PLN × 100). */
export const PL_PLAN_AMOUNT_GROSZE = {
  starter: 15900,
  team: 63900,
  business: 136900,
  enterprise: 265900,
};

/** Human-readable monthly labels (net). */
export const PL_PLAN_PRICE_LABELS = {
  starter: "159 zł",
  team: "639 zł",
  business: "1369 zł",
  enterprise: "2659 zł",
  trial: "0 zł",
};

export const PL_PRICING_FOOTNOTE = "Ceny w PLN netto (bez VAT 23%).";

/** @param {PlPaidPlanId | "trial"} planId */
export function getPlPlanPriceLabel(planId) {
  return PL_PLAN_PRICE_LABELS[planId] ?? "—";
}

/** @param {PlPaidPlanId} planId */
export function getPlPlanAmountGrosze(planId) {
  return PL_PLAN_AMOUNT_GROSZE[planId] ?? 0;
}

export const PL_STRIPE_PRICE_ENV_SUFFIX = "_PLN";

/** @param {PlPaidPlanId} planId @param {boolean} [testMode] */
export function stripeEnvKeyForPlPlan(planId, testMode = false) {
  const base = {
    starter: "STRIPE_PRICE_STARTER",
    team: "STRIPE_PRICE_TEAM",
    business: "STRIPE_PRICE_BUSINESS",
    enterprise: "STRIPE_PRICE_ENTERPRISE",
  }[planId];
  const testInfix = testMode ? "_TEST" : "";
  return `${base}${testInfix}${PL_STRIPE_PRICE_ENV_SUFFIX}`;
}
