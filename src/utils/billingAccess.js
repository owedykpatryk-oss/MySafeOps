import { getBillingEntitlements, getTrialExtensionCount, getTrialStatus } from "./orgMembership";

export const BILLING_WRITE_BLOCKED_EVENT = "mysafeops-billing-write-blocked";
export const MAX_TRIAL_EXTENSIONS = 1;
export const TRIAL_EXTENSION_DAYS = 14;
export const TRIAL_EXTENSION_REMINDER_DAYS = 5;

export function isPaidSubscriptionActive(billing) {
  const b = billing ?? getBillingEntitlements();
  return (
    (b.subscriptionStatus === "active" || b.subscriptionStatus === "trialing") && Boolean(b.paidPlanId)
  );
}

/** Cloud org with an ended evaluation trial and no paid subscription. */
export function isTrialExpiredWithoutPaid(options = {}) {
  if (options.isPlatformOwner) return false;
  if (isPaidSubscriptionActive(options.billing)) return false;
  const ts = options.trialStatus ?? getTrialStatus();
  if (!ts) return false;
  return !ts.isActive;
}

/** Block creates/edits when evaluation ended; local-only workspaces (no trial date) stay writable. */
export function isBillingWriteBlocked(options = {}) {
  return isTrialExpiredWithoutPaid(options);
}

export function canExtendOrgTrial(options = {}) {
  if (options.isPlatformOwner) return false;
  if (isPaidSubscriptionActive(options.billing)) return false;
  const count = options.trialExtensionCount ?? getTrialExtensionCount();
  return count < MAX_TRIAL_EXTENSIONS;
}

export function shouldShowTrialExtensionOffer(options = {}) {
  if (!canExtendOrgTrial(options)) return false;
  const ts = options.trialStatus ?? getTrialStatus();
  if (!ts) return false;
  if (ts.isActive) return ts.remainingDays <= TRIAL_EXTENSION_REMINDER_DAYS;
  return true;
}

export function billingWriteBlockedMessage() {
  return "Your evaluation trial has ended. Subscribe in Settings → Billing to create or edit records. You can still view and export existing data.";
}

export function notifyBillingWriteBlocked(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BILLING_WRITE_BLOCKED_EVENT, { detail }));
}
