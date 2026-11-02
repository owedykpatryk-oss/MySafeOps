/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  canExtendOrgTrial,
  isBillingWriteBlocked,
  isPaidSubscriptionWritable,
  isSubscriptionPastDueOrUnpaid,
  isTrialExpiredWithoutPaid,
  pastDueBillingMessage,
  shouldShowTrialExtensionOffer,
} from "./billingAccess";
import { getEffectivePlanId } from "../lib/billingPlans";
import { cacheActiveCountryWorkspace } from "./countryWorkspaces";
import { getTrialStatus } from "./billingState";

describe("billingAccess", () => {
  it("requires a separate subscription for a secondary country even without trial metadata", () => {
    localStorage.clear();
    cacheActiveCountryWorkspace({ id: "country", is_primary: false });
    expect(getTrialStatus()).toMatchObject({ isActive: false, countryWorkspaceRequiresSubscription: true });
    expect(isBillingWriteBlocked()).toBe(true);
    expect(canExtendOrgTrial()).toBe(false);
  });
  it("does not reopen an overdue subscription through an unexpired evaluation", () => {
    expect(isBillingWriteBlocked({ trialStatus: { isActive: true }, billing: { subscriptionStatus: "past_due", paidPlanId: "team", pastDueSince: "2020-01-01" } })).toBe(true);
    expect(canExtendOrgTrial({ trialStatus: { isActive: false }, billing: { subscriptionStatus: "past_due", paidPlanId: "team", pastDueSince: "2020-01-01" } })).toBe(false);
  });
  it("does not grant unlimited grace when the selected workspace has no past-due timestamp", () => {
    localStorage.setItem("mysafeops_subscription_past_due_since", "2020-01-01");
    expect(isBillingWriteBlocked({ trialStatus: { isActive: false }, billing: { subscriptionStatus: "past_due", paidPlanId: "team", pastDueSince: null } })).toBe(true);
  });
  it.each(["unpaid", "canceled", "paused", "incomplete", "incomplete_expired"])("does not reopen %s access through a future trial or extension", (subscriptionStatus) => {
    const billing = { subscriptionStatus, paidPlanId: null };
    expect(isBillingWriteBlocked({ trialStatus: { isActive: true }, billing })).toBe(true);
    expect(canExtendOrgTrial({ trialStatus: { isActive: true }, billing })).toBe(false);
    expect(getEffectivePlanId({ isActive: true }, billing)).toBe("expired");
  });
  it("keeps scheduled cancellation writable only until the paid period ends", () => {
    const billing = { subscriptionStatus: "active", paidPlanId: "team", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(Date.now() + 10000).toISOString() };
    expect(isPaidSubscriptionWritable(billing)).toBe(true);
    expect(isPaidSubscriptionWritable(billing, Date.now() + 20000)).toBe(false);
    expect(isBillingWriteBlocked({ trialStatus: { isActive: true }, billing: { ...billing, currentPeriodEnd: "2020-01-01" } })).toBe(true);
  });
  beforeEach(() => {
    localStorage.clear();
  });

  it("blocks writes when cloud trial expired without paid plan", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", past);
    expect(isBillingWriteBlocked()).toBe(true);
    expect(isTrialExpiredWithoutPaid()).toBe(true);
    expect(getEffectivePlanId({ isActive: false, remainingDays: 0 }, {})).toBe("expired");
  });

  it("lets a platform owner write after trial expiry with no subscription", () => {
    expect(
      isBillingWriteBlocked({
        trialStatus: { isActive: false },
        billing: { subscriptionStatus: "none" },
        isPlatformOwner: true,
      })
    ).toBe(false);
    expect(
      isTrialExpiredWithoutPaid({
        trialStatus: { isActive: false },
        billing: { subscriptionStatus: "none" },
        isPlatformOwner: true,
      })
    ).toBe(false);
    expect(
      isBillingWriteBlocked({
        trialStatus: { isActive: false },
        billing: { subscriptionStatus: "unpaid", paidPlanId: "team" },
        isPlatformOwner: true,
      })
    ).toBe(false);
  });

  it("allows writes during active trial", () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", future);
    expect(isBillingWriteBlocked()).toBe(false);
    expect(getEffectivePlanId({ isActive: true, remainingDays: 5 }, {})).toBe("trial");
  });

  it("allows writes for local workspace without trial metadata", () => {
    expect(isBillingWriteBlocked()).toBe(false);
    expect(getEffectivePlanId(null, {})).toBe("local");
  });

  it("allows writes with active paid subscription", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", past);
    expect(
      isBillingWriteBlocked({
        trialStatus: { isActive: false },
        billing: { subscriptionStatus: "active", paidPlanId: "team" },
      })
    ).toBe(false);
  });

  it("offers extension once before max count", () => {
    const future = new Date(Date.now() + 2 * 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", future);
    expect(canExtendOrgTrial()).toBe(true);
    expect(shouldShowTrialExtensionOffer()).toBe(true);
    localStorage.setItem("mysafeops_trial_extension_count", "1");
    expect(canExtendOrgTrial()).toBe(false);
  });

  it("flags past_due and unpaid subscription statuses", () => {
    expect(isSubscriptionPastDueOrUnpaid({ subscriptionStatus: "past_due", paidPlanId: "team" })).toBe(true);
    expect(isSubscriptionPastDueOrUnpaid({ subscriptionStatus: "unpaid", paidPlanId: "team" })).toBe(true);
    expect(isSubscriptionPastDueOrUnpaid({ subscriptionStatus: "active", paidPlanId: "team" })).toBe(false);
    expect(pastDueBillingMessage("unpaid")).toMatch(/unpaid/i);
    expect(pastDueBillingMessage("past_due")).toMatch(/outstanding invoice/i);
  });

  it("keeps past_due writable inside grace window", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", past);
    localStorage.setItem("mysafeops_subscription_past_due_since", new Date(Date.now() - 2 * 86400000).toISOString());
    expect(
      isBillingWriteBlocked({
        trialStatus: { isActive: false },
        billing: {
          subscriptionStatus: "past_due",
          paidPlanId: "team",
          pastDueSince: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
      })
    ).toBe(false);
  });

  it("blocks past_due after grace window", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", past);
    expect(
      isBillingWriteBlocked({
        trialStatus: { isActive: false },
        billing: {
          subscriptionStatus: "past_due",
          paidPlanId: "team",
          pastDueSince: new Date(Date.now() - 10 * 86400000).toISOString(),
        },
      })
    ).toBe(true);
  });

  it("hard-blocks unpaid even with paidPlanId cached", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", past);
    expect(
      isBillingWriteBlocked({
        trialStatus: { isActive: false },
        billing: { subscriptionStatus: "unpaid", paidPlanId: "team" },
      })
    ).toBe(true);
  });
});
