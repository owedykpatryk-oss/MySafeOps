/**
 * Austrian list prices (EUR, net of VAT). Reuses DE net amounts; USt 20% at checkout.
 * Shares Stripe STRIPE_PRICE_*_EUR catalogue with Germany.
 */

import {
  DE_PLAN_AMOUNT_CENTS,
  DE_PLAN_PRICE_LABELS,
  DE_STRIPE_PRICE_ENV_SUFFIX,
  stripeEnvKeyForDePlan,
} from "./dePricing";

/** @typedef {"starter"|"team"|"business"|"enterprise"} AtPaidPlanId */

export const AT_PLAN_AMOUNT_CENTS = { ...DE_PLAN_AMOUNT_CENTS };

export const AT_PLAN_PRICE_LABELS = { ...DE_PLAN_PRICE_LABELS };

export const AT_PRICING_FOOTNOTE = "Preise in EUR netto (ohne 20 % USt).";

/** @param {AtPaidPlanId | "trial"} planId */
export function getAtPlanPriceLabel(planId) {
  return AT_PLAN_PRICE_LABELS[planId] ?? "—";
}

/** @param {AtPaidPlanId} planId */
export function getAtPlanAmountCents(planId) {
  return AT_PLAN_AMOUNT_CENTS[planId] ?? 0;
}

/** Same Stripe env keys as DE — shared EUR price IDs. */
export const AT_STRIPE_PRICE_ENV_SUFFIX = DE_STRIPE_PRICE_ENV_SUFFIX;

/** @param {AtPaidPlanId} planId @param {boolean} [testMode] */
export function stripeEnvKeyForAtPlan(planId, testMode = false) {
  return stripeEnvKeyForDePlan(planId, testMode);
}
