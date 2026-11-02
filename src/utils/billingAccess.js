import {
  getBillingEntitlements,
  getTrialExtensionCount,
  getTrialStatus,
} from "./billingState";
import { isPlatformOwnerCached } from "./superAdmin";

export const BILLING_WRITE_BLOCKED_EVENT = "mysafeops-billing-write-blocked";
export const MAX_TRIAL_EXTENSIONS = 1;
export const TRIAL_EXTENSION_DAYS = 14;
export const TRIAL_EXTENSION_REMINDER_DAYS = 5;
/** Days a past_due subscription remains writable while Stripe retries collection. */
export const PAST_DUE_WRITE_GRACE_DAYS = 7;

export function isPaidSubscriptionActive(billing, now = Date.now()) {
  const b = billing ?? getBillingEntitlements();
  return (
    (b.subscriptionStatus === "active" || b.subscriptionStatus === "trialing") && Boolean(b.paidPlanId)
    && (!b.cancelAtPeriodEnd || now < new Date(b.currentPeriodEnd).getTime())
  );
}

/** Active paid, or past_due still inside the write grace window (plan retained). */
export function isPaidSubscriptionWritable(billing, now = Date.now()) {
  const b = billing ?? getBillingEntitlements();
  if (b.cancelAtPeriodEnd && !(now < new Date(b.currentPeriodEnd).getTime())) return false;
  if (isPaidSubscriptionActive(b, now)) return true;
  if (String(b.subscriptionStatus || "").toLowerCase() !== "past_due" || !b.paidPlanId) return false;
  const sinceRaw = b.pastDueSince;
  if (!sinceRaw) return false;
  const since = new Date(sinceRaw).getTime();
  if (!Number.isFinite(since)) return false;
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
  return "There is an outstanding invoice for this country. Editing is available for up to 7 days after the first failed payment, then becomes read-only. Open Billing to pay and restore access.";
}

function resolvePlatformOwner(options = {}) {
  if (typeof options.isPlatformOwner === "boolean") return options.isPlatformOwner;
  return isPlatformOwnerCached();
}

/** Cloud org with an ended evaluation trial and no paid subscription. */
export function isTrialExpiredWithoutPaid(options = {}) {
  if (resolvePlatformOwner(options)) return false;
  if (isPaidSubscriptionWritable(options.billing)) return false;
  const status = (options.billing ?? getBillingEntitlements()).subscriptionStatus;
  if (status && status !== "none") return true;
  const ts = options.trialStatus ?? getTrialStatus();
  if (!ts) return false;
  return !ts.isActive;
}

/** Block creates/edits when evaluation ended; local-only workspaces (no trial date) stay writable. */
export function isBillingWriteBlocked(options = {}) {
  const billing = options.billing ?? getBillingEntitlements();
  const status = String(billing?.subscriptionStatus || "").toLowerCase();
  const isPlatformOwner = resolvePlatformOwner(options);
  if (isPlatformOwner || isPaidSubscriptionWritable(billing)) return false;
  // A subscription that is no longer writable cannot fall back to an old trial.
  if (status && status !== "none") return true;
  return isTrialExpiredWithoutPaid({ ...options, isPlatformOwner });
}

export function canExtendOrgTrial(options = {}) {
  if (resolvePlatformOwner(options)) return false;
  const ts = options.trialStatus ?? getTrialStatus();
  if (ts?.countryWorkspaceRequiresSubscription) return false;
  const billing = options.billing ?? getBillingEntitlements();
  if (billing.subscriptionStatus && billing.subscriptionStatus !== "none") return false;
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
  if (getTrialStatus()?.countryWorkspaceRequiresSubscription) return "This country workspace requires its own active subscription. Open Settings → Billing to create or edit records. Existing records remain available to view and export.";
  if (isSubscriptionPastDueOrUnpaid()) return "Editing is paused because payment is overdue. Open Settings → Billing to resolve the payment and restore access. Existing records remain available to view and export.";
  return "Your evaluation trial has ended. Subscribe in Settings → Billing to create or edit site records (RAMS, permits, workers, projects). You can still view, export, and change organisation settings (branding, sectors, automation).";
}

export function notifyBillingWriteBlocked(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BILLING_WRITE_BLOCKED_EVENT, { detail }));
}
