/** @vitest-environment jsdom */
import { beforeEach, expect, it, vi } from "vitest";
import { loadCountryWorkspaces, cacheActiveCountryWorkspace, ensureLegacyCountryWorkspace, getCachedActiveCountryWorkspaceId } from "./countryWorkspaces";
import { persistOrgRow } from "./orgMembership";
import { getBillingEntitlements } from "./billingState";
import { isBillingWriteBlocked } from "./billingAccess";

beforeEach(() => localStorage.clear());

it("does not switch a selected secondary country back to primary on billing refresh", async () => {
  cacheActiveCountryWorkspace({ id: "secondary", is_primary: false }, "acme");
  await ensureLegacyCountryWorkspace({ rpc: async () => ({ data: "primary" }) }, "uk", "acme");
  expect(getCachedActiveCountryWorkspaceId("acme")).toBe("secondary");
});
function client({ unavailable = false } = {}) {
  const rows = [{ id: "primary", is_primary: true, enabled: true }, { id: "secondary", is_primary: false, enabled: true }];
  const billing = [{ workspace_id: "primary", stripe_mode: "test", billing_plan: "enterprise", subscription_status: "active" }];
  const chain = (data) => {
    const q = { select: () => q, eq: () => q, limit: () => q, order: () => q,
      maybeSingle: async () => ({ data }), then: (resolve) => Promise.resolve({ data }).then(resolve) };
    return q;
  };
  return {
    from: (table) => chain(table === "organizations" ? { id: "org", trial_ends_at: "2027-01-01T00:00:00Z" } : rows),
    auth: { getUser: async () => ({ data: {} }) },
    rpc: vi.fn().mockResolvedValue(unavailable ? { error: new Error("offline") } : { data: billing }),
  };
}

it("exposes the organisation evaluation deadline only for its primary country", async () => {
  const rows = await loadCountryWorkspaces(client(), "acme");
  expect(rows[0].evaluation_trial_ends_at).toBe("2027-01-01T00:00:00Z");
  expect(rows[1].evaluation_trial_ends_at).toBeNull();
});

it("loads operational entitlements using the server mode, without hard-coding live", async () => {
  const supabase = client();
  const rows = await loadCountryWorkspaces(supabase, "acme");
  expect(supabase.rpc).toHaveBeenCalledWith("get_my_country_workspace_entitlements", { p_org_slug: "acme", p_stripe_mode: null });
  expect(rows[0].billing).toMatchObject({ billing_plan: "enterprise", stripe_mode: "test" });
});

it("keeps explicit billing preview modes separate from the operational default", async () => {
  const supabase = client();
  await loadCountryWorkspaces(supabase, "acme", { stripeMode: "live" });
  expect(supabase.rpc).toHaveBeenCalledWith("get_my_country_workspace_entitlements", { p_org_slug: "acme", p_stripe_mode: "live" });
});

it("distinguishes an unavailable entitlement read from an unpaid subscription", async () => {
  expect((await loadCountryWorkspaces(client({ unavailable: true }), "acme"))[0]).toMatchObject({ billing_unavailable: true, billing: null });
});

it("does not relock a paid primary workspace when legacy organization billing refreshes", async () => {
  localStorage.setItem("mysafeops_orgId", "acme");
  const [workspace] = await loadCountryWorkspaces(client(), "acme");
  cacheActiveCountryWorkspace(workspace, "acme");
  persistOrgRow({ trial_ends_at: "2020-01-01", ...workspace.billing }, { billingScope: "workspace" });
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(false);
  persistOrgRow({ trial_ends_at: "2020-01-01", billing_plan: null, subscription_status: "none" });
  expect(getBillingEntitlements()).toMatchObject({ paidPlanId: "enterprise", subscriptionStatus: "active" });
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(false);
  persistOrgRow({ billing_plan: null, subscription_status: "canceled" }, { billingScope: "workspace" });
  expect(isBillingWriteBlocked({ isPlatformOwner: false })).toBe(true);
});
