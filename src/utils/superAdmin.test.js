import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("superAdmin platform owner probe", () => {
  beforeEach(() => {
    vi.resetModules();
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
});
