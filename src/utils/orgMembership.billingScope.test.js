/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("orgMembership billing/trial org-scoping (shared-device isolation)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persists trial/billing state under org-scoped keys, not the bare legacy key", async () => {
    localStorage.setItem("mysafeops_orgId", "acme-ltd");
    const { persistOrgRow } = await import("./orgMembership.js");
    persistOrgRow({
      role: "admin",
      trial_ends_at: "2027-01-01T00:00:00.000Z",
      billing_plan: "team",
      subscription_status: "active",
      trial_extension_count: 1,
    });

    expect(localStorage.getItem("mysafeops_trial_ends_at_acme-ltd")).toBe("2027-01-01T00:00:00.000Z");
    expect(localStorage.getItem("mysafeops_billing_plan_acme-ltd")).toBe("team");
    expect(localStorage.getItem("mysafeops_subscription_status_acme-ltd")).toBe("active");
    expect(localStorage.getItem("mysafeops_trial_extension_count_acme-ltd")).toBe("1");
    // Legacy unscoped keys must not be written for real orgs.
    expect(localStorage.getItem("mysafeops_trial_ends_at")).toBeNull();
    expect(localStorage.getItem("mysafeops_billing_plan")).toBeNull();
  });

  it("switching org slug on a shared device does not leak the previous org's trial/billing state", async () => {
    localStorage.setItem("mysafeops_orgId", "org-a");
    const { persistOrgRow, getTrialStatus, getBillingEntitlements } = await import("./orgMembership.js");
    persistOrgRow({
      role: "admin",
      trial_ends_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      billing_plan: "team",
      subscription_status: "active",
    });
    expect(getTrialStatus()?.isActive).toBe(true);
    expect(getBillingEntitlements().paidPlanId).toBe("team");

    // Switch device to a different org that has no billing state yet.
    localStorage.setItem("mysafeops_orgId", "org-b");
    expect(getTrialStatus()).toBeNull();
    expect(getBillingEntitlements().paidPlanId).toBeNull();
  });

  it("falls back to the legacy unscoped key for the default/solo slug", async () => {
    localStorage.setItem("mysafeops_orgId", "default");
    const { persistOrgRow, getTrialStatus } = await import("./orgMembership.js");
    persistOrgRow({ trial_ends_at: new Date(Date.now() + 86400000).toISOString() });
    expect(localStorage.getItem("mysafeops_trial_ends_at")).not.toBeNull();
    expect(getTrialStatus()?.isActive).toBe(true);
  });
});
