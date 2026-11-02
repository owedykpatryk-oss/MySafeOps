/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ensureUserOrgContext invite synchronization", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("shares one acceptance RPC across concurrent auth callbacks", async () => {
    let resolveRpc;
    const rpcResult = new Promise((resolve) => {
      resolveRpc = resolve;
    });
    const supabase = {
      rpc: vi.fn(() => rpcResult),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-a" } } } }),
      },
    };
    const { setPendingInviteToken, peekPendingInvite } = await import("../lib/inviteToken.js");
    const { ensureUserOrgContext } = await import("./orgMembership.js");
    setPendingInviteToken("invite-1", "worker@example.com");

    const first = ensureUserOrgContext(supabase, "user-a");
    const second = ensureUserOrgContext(supabase, "user-a");
    expect(first).toBe(second);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    resolveRpc({
      data: [{ org_slug: "utility-mapping", org_name: "Utility Mapping", role: "operative" }],
      error: null,
    });
    await expect(first).resolves.toMatchObject({ org_slug: "utility-mapping" });
    expect(peekPendingInvite()).toBeNull();
  });

  it("does not reuse or apply an old account's organisation response after account switch", async () => {
    let resolveA;
    let resolveB;
    const firstRpc = new Promise((resolve) => { resolveA = resolve; });
    const secondRpc = new Promise((resolve) => { resolveB = resolve; });
    let activeUserId = "user-a";
    const supabase = {
      rpc: vi.fn().mockReturnValueOnce(firstRpc).mockReturnValueOnce(secondRpc),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: activeUserId } } } })),
        getUser: vi.fn(async () => ({ data: { user: { id: activeUserId } } })),
      },
    };
    const { getOrgId } = await import("./orgId.js");
    const { ensureUserOrgContext } = await import("./orgMembership.js");

    const fromA = ensureUserOrgContext(supabase, "user-a");
    activeUserId = "user-b";
    const fromB = ensureUserOrgContext(supabase, "user-b");
    expect(fromB).not.toBe(fromA);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);

    resolveB({ data: [{ org_slug: "org-b", role: "operative" }], error: null });
    await expect(fromB).resolves.toMatchObject({ org_slug: "org-b" });
    expect(getOrgId()).toBe("org-b");

    resolveA({ data: [{ org_slug: "org-a", role: "admin" }], error: null });
    await expect(fromA).rejects.toThrow("session_changed");
    expect(getOrgId()).toBe("org-b");
  });

  it("does not apply late branding from the previous account", async () => {
    let resolveOldBranding;
    const oldBranding = new Promise((resolve) => { resolveOldBranding = resolve; });
    let activeUserId = "user-a";
    const supabase = {
      rpc: vi.fn((name) => {
        if (name === "ensure_my_org") return Promise.resolve({
          data: [{ org_slug: activeUserId === "user-a" ? "org-a" : "org-b", role: "operative" }],
          error: null,
        });
        if (name === "get_my_org_branding") return activeUserId === "user-a"
          ? oldBranding
          : Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: activeUserId } } } })),
        getUser: vi.fn(async () => ({ data: { user: { id: activeUserId } } })),
      },
    };
    const { ensureUserOrgContext } = await import("./orgMembership.js");
    const { loadOrgSettingsRaw } = await import("./orgSettingsStorage.js");

    const fromA = ensureUserOrgContext(supabase, "user-a");
    await vi.waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("get_my_org_branding"));
    activeUserId = "user-b";
    await ensureUserOrgContext(supabase, "user-b");

    resolveOldBranding({
      data: { settings: { name: "Stale A branding" }, updated_at: "2030-01-01T00:00:00Z" },
      error: null,
    });
    await expect(fromA).rejects.toThrow("session_changed");
    expect(loadOrgSettingsRaw("org-a").name).not.toBe("Stale A branding");
  });
});

describe("refreshOrgFromSupabase session isolation", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does not apply a previous user's late organisation refresh", async () => {
    let resolveOldRpc;
    const oldRpc = new Promise((resolve) => { resolveOldRpc = resolve; });
    let activeUserId = "user-a";
    const supabase = {
      rpc: vi.fn().mockReturnValueOnce(oldRpc).mockResolvedValueOnce({
        data: [{ org_slug: "org-b", role: "operative" }], error: null,
      }),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: activeUserId } } } })),
        getUser: vi.fn(async () => ({ data: { user: { id: activeUserId } } })),
      },
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      })),
    };
    const { getOrgId } = await import("./orgId.js");
    const { refreshOrgFromSupabase } = await import("./orgMembership.js");

    const fromA = refreshOrgFromSupabase(supabase);
    await vi.waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
    activeUserId = "user-b";
    const fromB = refreshOrgFromSupabase(supabase);
    await expect(fromB).resolves.toMatchObject({ org_slug: "org-b" });
    expect(getOrgId()).toBe("org-b");

    resolveOldRpc({ data: [{ org_slug: "org-a", role: "admin" }], error: null });
    await expect(fromA).rejects.toThrow("session_changed");
    expect(getOrgId()).toBe("org-b");
  });
});
