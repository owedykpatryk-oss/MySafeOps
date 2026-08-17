/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("superAdmin platform owner probe", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("fails closed before any server probe", async () => {
    const { isSuperAdminEmail, SUPERADMIN_EMAIL, isPlatformOwnerCached } = await import("./superAdmin.js");
    expect(isPlatformOwnerCached()).toBe(false);
    expect(isSuperAdminEmail("anyone@example.com")).toBe(false);
    expect(SUPERADMIN_EMAIL).toBe("");
  });

  it("respects setPlatformOwnerCached for UI gates", async () => {
    const { setPlatformOwnerCached, isSuperAdminEmail, isPlatformOwnerEmail } = await import("./superAdmin.js");
    setPlatformOwnerCached(true);
    expect(isSuperAdminEmail("ignored@example.com")).toBe(true);
    expect(isPlatformOwnerEmail()).toBe(true);
    setPlatformOwnerCached(false);
    expect(isSuperAdminEmail("ignored@example.com")).toBe(false);
  });

  it("refreshPlatformOwnerFromSupabase uses RPC and fails closed on error", async () => {
    vi.doMock("../lib/supabase", () => ({
      isSupabaseConfigured: () => true,
      supabase: {
        rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      },
    }));
    const { refreshPlatformOwnerFromSupabase, isPlatformOwnerCached } = await import("./superAdmin.js");
    await expect(refreshPlatformOwnerFromSupabase()).resolves.toBe(true);
    expect(isPlatformOwnerCached()).toBe(true);

    vi.resetModules();
    vi.doMock("../lib/supabase", () => ({
      isSupabaseConfigured: () => true,
      supabase: {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "nope" } }),
      },
    }));
    const mod2 = await import("./superAdmin.js");
    await expect(mod2.refreshPlatformOwnerFromSupabase()).resolves.toBe(false);
    expect(mod2.isPlatformOwnerCached()).toBe(false);
  });

  it("superadminExtendOrgTrial calls owner RPC and persists when the active org matches", async () => {
    localStorage.setItem("mysafeops_orgId", "utility-mapping");
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, org_slug: "utility-mapping", trial_ends_at: "2026-08-31T12:00:00.000Z", days: 14 },
      error: null,
    });
    const { superadminExtendOrgTrial } = await import("./superAdmin.js");
    const row = await superadminExtendOrgTrial({ rpc }, "utility-mapping", 14);
    expect(rpc).toHaveBeenCalledWith("superadmin_extend_org_trial", {
      p_org_slug: "utility-mapping",
      p_days: 14,
    });
    expect(row.ok).toBe(true);
    expect(localStorage.getItem("mysafeops_trial_ends_at_utility-mapping")).toBe("2026-08-31T12:00:00.000Z");
  });

  it("superadminExtendOrgTrial does not write billing keys for a different org", async () => {
    localStorage.setItem("mysafeops_orgId", "fess-group");
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, org_slug: "utility-mapping", trial_ends_at: "2026-08-31T12:00:00.000Z", days: 14 },
      error: null,
    });
    const { superadminExtendOrgTrial } = await import("./superAdmin.js");
    await superadminExtendOrgTrial({ rpc }, "utility-mapping");
    expect(localStorage.getItem("mysafeops_trial_ends_at_fess-group")).toBeNull();
    expect(localStorage.getItem("mysafeops_trial_ends_at_utility-mapping")).toBeNull();
  });

  it("superadminExtendOrgTrial throws a clear error when the RPC is forbidden", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: false, error: "forbidden" }, error: null });
    const { superadminExtendOrgTrial } = await import("./superAdmin.js");
    await expect(superadminExtendOrgTrial({ rpc }, "utility-mapping")).rejects.toThrow(/platform owner/i);
  });
});
