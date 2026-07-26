/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  canExtendOrgTrial,
  isBillingWriteBlocked,
  isSubscriptionPastDueOrUnpaid,
  isTrialExpiredWithoutPaid,
  pastDueBillingMessage,
  shouldShowTrialExtensionOffer,
} from "./billingAccess";
import { getEffectivePlanId } from "../lib/billingPlans";

describe("billingAccess", () => {
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
