import { getOrgId } from "./orgId";

export const ORG_TRIAL_ENDS_AT_KEY = "mysafeops_trial_ends_at";
export const ORG_BILLING_PLAN_KEY = "mysafeops_billing_plan";
export const ORG_SUBSCRIPTION_STATUS_KEY = "mysafeops_subscription_status";
export const ORG_TRIAL_EXTENSION_COUNT_KEY = "mysafeops_trial_extension_count";

export function scopedBillingKey(baseKey, slug = getOrgId()) {
  return slug && slug !== "default" ? `${baseKey}_${slug}` : baseKey;
}

export function readScopedBilling(baseKey, slug = getOrgId()) {
  try {
    const scoped = localStorage.getItem(scopedBillingKey(baseKey, slug));
    if (scoped != null) return scoped;
    return localStorage.getItem(baseKey);
  } catch {
    return null;
  }
}

export function writeScopedBilling(baseKey, value, slug = getOrgId()) {
  try {
    localStorage.setItem(scopedBillingKey(baseKey, slug), String(value));
  } catch {
    /* ignore */
  }
}

export function removeScopedBilling(baseKey, slug = getOrgId()) {
  try {
    localStorage.removeItem(scopedBillingKey(baseKey, slug));
  } catch {
    /* ignore */
  }
}

export function getTrialExtensionCount() {
  const raw = readScopedBilling(ORG_TRIAL_EXTENSION_COUNT_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export function getTrialStatus(now = Date.now()) {
  const raw = readScopedBilling(ORG_TRIAL_ENDS_AT_KEY);
  if (!raw) return null;
  const endsAt = new Date(raw).getTime();
  if (!Number.isFinite(endsAt)) return null;
  const remainingMs = endsAt - now;
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  return {
    endsAtIso: new Date(endsAt).toISOString(),
    isActive: remainingMs > 0,
    remainingDays,
  };
}

export function isTrialUnlockActive(now = Date.now()) {
  return Boolean(getTrialStatus(now)?.isActive);
}

export function getBillingEntitlements() {
  const sub = readScopedBilling(ORG_SUBSCRIPTION_STATUS_KEY) || "none";
  const paid = readScopedBilling(ORG_BILLING_PLAN_KEY);
  const paidPlanId =
    paid && ["starter", "team", "business", "enterprise", "enterprise_plus"].includes(paid) ? paid : null;
  return { subscriptionStatus: sub, paidPlanId };
}
