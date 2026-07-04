/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  canExtendOrgTrial,
  isBillingWriteBlocked,
  isTrialExpiredWithoutPaid,
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
});
