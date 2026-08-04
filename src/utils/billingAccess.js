import {
  getBillingEntitlements,
  getTrialExtensionCount,
  getTrialStatus,
  ORG_PAST_DUE_SINCE_KEY,
  readScopedBilling,
} from "./billingState";
import { isPlatformOwnerCached } from "./superAdmin";

export const BILLING_WRITE_BLOCKED_EVENT = "mysafeops-billing-write-blocked";
export const MAX_TRIAL_EXTENSIONS = 1;
export const TRIAL_EXTENSION_DAYS = 14;
export const TRIAL_EXTENSION_REMINDER_DAYS = 5;
/** Days a past_due subscription remains writable while Stripe retries collection. */
export const PAST_DUE_WRITE_GRACE_DAYS = 7;

export function isPaidSubscriptionActive(billing) {
  const b = billing ?? getBillingEntitlements();
  return (
    (b.subscriptionStatus === "active" || b.subscriptionStatus === "trialing") && Boolean(b.paidPlanId)
  );
}

/** Active paid, or past_due still inside the write grace window (plan retained). */
export function isPaidSubscriptionWritable(billing, now = Date.now()) {
  const b = billing ?? getBillingEntitlements();
  if (isPaidSubscriptionActive(b)) return true;
  if (String(b.subscriptionStatus || "").toLowerCase() !== "past_due" || !b.paidPlanId) return false;
  const sinceRaw = b.pastDueSince || readScopedBilling(ORG_PAST_DUE_SINCE_KEY);
  if (!sinceRaw) {
    // Unknown start — treat as still in grace (banner still shown).
    return true;
  }
  const since = new Date(sinceRaw).getTime();
  if (!Number.isFinite(since)) return true;
  const graceMs = PAST_DUE_WRITE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now - since < graceMs;
}

/** Stripe reports open invoices / failed collection — org should open the billing portal. */
export function isSubscriptionPastDueOrUnpaid(billing) {
  const b = billing ?? getBillingEntitlements();
  const status = String(b?.subscriptionStatus || "").toLowerCase();
  return status === "past_due" || status === "unpaid";
}

export function pastDueBillingMessage(status) {
  const s = String(status || "").toLowerCase();
  if (s === "unpaid") {
    return "Payment failed and the subscription is unpaid. Open Billing to pay outstanding invoices and restore full access.";
  }
  return "There is an outstanding invoice on this organisation. Open Billing to pay now and avoid service disruption.";
}

function resolvePlatformOwner(options = {}) {
  if (typeof options.isPlatformOwner === "boolean") return options.isPlatformOwner;
  return isPlatformOwnerCached();
}

/** Cloud org with an ended evaluation trial and no paid subscription. */
export function isTrialExpiredWithoutPaid(options = {}) {
  if (resolvePlatformOwner(options)) return false;
  if (isPaidSubscriptionWritable(options.billing)) return false;
  const ts = options.trialStatus ?? getTrialStatus();
  if (!ts) return false;
  return !ts.isActive;
}

/** Block creates/edits when evaluation ended; local-only workspaces (no trial date) stay writable. */
export function isBillingWriteBlocked(options = {}) {
  const billing = options.billing ?? getBillingEntitlements();
  const status = String(billing?.subscriptionStatus || "").toLowerCase();
  const isPlatformOwner = resolvePlatformOwner(options);
  // Hard-block unpaid/canceled even if plan id is still cached.
  if (status === "unpaid" || status === "canceled") {
    if (isPlatformOwner) return false;
    const ts = options.trialStatus ?? getTrialStatus();
    if (ts && !ts.isActive) return true;
    if (!ts && billing?.paidPlanId) return true;
  }
  return isTrialExpiredWithoutPaid({ ...options, isPlatformOwner });
}

export function canExtendOrgTrial(options = {}) {
  if (resolvePlatformOwner(options)) return false;
  if (isPaidSubscriptionActive(options.billing) || isPaidSubscriptionWritable(options.billing)) return false;
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
  return "Your evaluation trial has ended. Subscribe in Settings → Billing to create or edit site records (RAMS, permits, workers, projects). You can still view, export, and change organisation settings (branding, sectors, automation).";
}

export function notifyBillingWriteBlocked(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BILLING_WRITE_BLOCKED_EVENT, { detail }));
}
