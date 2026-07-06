/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("refreshMembershipRoleFromSupabase", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "acme-ltd");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("persists server role and dispatches org-updated", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: "supervisor", error: null }),
    };
    const { refreshMembershipRoleFromSupabase } = await import("./orgMembership.js");
    const role = await refreshMembershipRoleFromSupabase(supabase);
    expect(role).toBe("supervisor");
    expect(localStorage.getItem("mysafeops_role_acme-ltd")).toBe("supervisor");
    expect(supabase.rpc).toHaveBeenCalledWith("get_my_membership_role", { p_org_slug: "acme-ltd" });
    expect(dispatch).toHaveBeenCalled();
  });

  it("returns null for unknown role from server", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: "owner", error: null }),
    };
    const { refreshMembershipRoleFromSupabase } = await import("./orgMembership.js");
    const role = await refreshMembershipRoleFromSupabase(supabase);
    expect(role).toBeNull();
    expect(localStorage.getItem("mysafeops_role_acme-ltd")).toBeNull();
  });

  it("skips when org slug is default", async () => {
    localStorage.setItem("mysafeops_orgId", "default");
    const supabase = { rpc: vi.fn() };
    const { refreshMembershipRoleFromSupabase } = await import("./orgMembership.js");
    const role = await refreshMembershipRoleFromSupabase(supabase);
    expect(role).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
