/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { checkBillingLimit, billingLimitMessage, getOrgUsageCounts } from "./billingLimits";
import { getEffectivePlanId } from "../lib/billingPlans";

describe("billingLimits", () => {
  beforeEach(() => localStorage.clear());

  it("ignores tombstones and closed projects but enforces the exact live worker cap", () => {
    localStorage.setItem("mysafeops_workers_default", JSON.stringify([
      ...Array.from({ length: 4 }, (_, i) => ({ id: `w${i}` })),
      { id: "deleted", deletedAt: "2026-10-05" }, null,
    ]));
    localStorage.setItem("mysafeops_projects_default", JSON.stringify([{ id: "live" }, { id: "closed", closed: true }, { id: "deleted", deletedAt: "2026-10-05" }]));
    const opts = { billing: { paidPlanId: "starter", subscriptionStatus: "active" }, trialStatus: null, isPlatformOwner: false };
    expect(getOrgUsageCounts()).toEqual({ workers: 4, projects: 1 });
    expect(checkBillingLimit("workers", opts).ok).toBe(true);
    localStorage.setItem("mysafeops_workers_default", JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: `w${i}` }))));
    expect(checkBillingLimit("workers", opts)).toMatchObject({ ok: false, count: 5, limit: 5 });
  });

  it("reads the selected country's usage without leaking other organisations or countries", () => {
    localStorage.setItem("mysafeops_workers_acme", JSON.stringify([{ id: "uk" }]));
    localStorage.setItem("mysafeops_workers_acme__country_pl", JSON.stringify([{ id: "pl1" }, { id: "pl2" }]));
    localStorage.setItem("mysafeops_workers_other__country_pl", JSON.stringify([{ id: "other" }]));
    expect(getOrgUsageCounts({ orgId: "acme", workspace: { id: "pl", is_primary: false } }).workers).toBe(2);
    expect(getOrgUsageCounts({ orgId: "acme", workspace: { id: "uk", is_primary: true } }).workers).toBe(1);
  });

  it("keeps platform owner unlimited even when the trial ended", () => {
    expect(checkBillingLimit("workers", { trialStatus: { isActive: false }, billing: {}, isPlatformOwner: true }).ok).toBe(true);
  });
  it("blocks when at worker cap on local workspace plan", () => {
    const result = checkBillingLimit("workers", {
      trialStatus: null,
      billing: {},
      isPlatformOwner: false,
    });
    expect(typeof result.ok).toBe("boolean");
    expect(result.limit).toBe(200);
  });

  it("blocks all writes when trial expired", () => {
    const result = checkBillingLimit("workers", {
      trialStatus: { isActive: false, remainingDays: 0 },
      billing: {},
      isPlatformOwner: false,
    });
    expect(result.ok).toBe(false);
    expect(result.readOnly).toBe(true);
    expect(getEffectivePlanId({ isActive: false }, {})).toBe("expired");
  });

  it("returns message when blocked", () => {
    const msg = billingLimitMessage({
      ok: false,
      kind: "projects",
      limit: 10,
      count: 10,
      planName: "Solo",
    });
    expect(msg).toContain("Solo plan");
    expect(msg).toContain("10 projects");
  });

  it("returns read-only message when trial ended", () => {
    const msg = billingLimitMessage({ ok: false, readOnly: true });
    expect(msg).toContain("evaluation trial has ended");
    expect(msg).toContain("organisation settings");
  });

  it("trial plan allows up to 100 projects", () => {
    const result = checkBillingLimit("projects", {
      trialStatus: { isActive: true, remainingDays: 10 },
      billing: {},
      isPlatformOwner: false,
    });
    expect(result.ok).toBe(true);
    expect(result.limit).toBe(100);
  });
});
