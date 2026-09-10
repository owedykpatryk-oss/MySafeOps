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
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    const { setPendingInviteToken, peekPendingInvite } = await import("../lib/inviteToken.js");
    const { ensureUserOrgContext } = await import("./orgMembership.js");
    setPendingInviteToken("invite-1", "worker@example.com");

    const first = ensureUserOrgContext(supabase);
    const second = ensureUserOrgContext(supabase);
    expect(first).toBe(second);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    resolveRpc({
      data: [{ org_slug: "utility-mapping", org_name: "Utility Mapping", role: "operative" }],
      error: null,
    });
    await expect(first).resolves.toMatchObject({ org_slug: "utility-mapping" });
    expect(peekPendingInvite()).toBeNull();
  });
});
