/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { saveOrgScoped, ORG_DATA_CHANGED_EVENT } from "./orgStorage";
import { markPortalPublished } from "./clientPortalPublished";
import { republishPublishedPortals, initPortalCloudAutoSync } from "./clientPortalAutoSync";

vi.mock("./orgMembership", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    syncOrgSlugIfNeeded: vi.fn(async () => "test-org"),
    getBillingEntitlements: vi.fn(() => ({ subscriptionStatus: "active", trialEndsAt: null })),
  };
});

vi.mock("./clientPortalCloud", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    publishPortalToCloud: vi.fn(async () => ({ ok: true })),
  };
});

import { publishPortalToCloud } from "./clientPortalCloud";

describe("clientPortalAutoSync", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saveOrgScoped emits ORG_DATA_CHANGED_EVENT", () => {
    const handler = vi.fn();
    window.addEventListener(ORG_DATA_CHANGED_EVENT, handler);
    saveOrgScoped("rams_builder_docs", [{ id: "r1" }]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.baseKey).toBe("rams_builder_docs");
    window.removeEventListener(ORG_DATA_CHANGED_EVENT, handler);
  });

  it("republishPublishedPortals skips when no published tokens", async () => {
    const supabase = { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } };
    const result = await republishPublishedPortals(supabase);
    expect(result.count).toBe(0);
    expect(publishPortalToCloud).not.toHaveBeenCalled();
  });

  it("republishPublishedPortals publishes active cloud portals", async () => {
    const token = "portal-token-abc12345";
    markPortalPublished(token);
    saveOrgScoped("client_portals", [
      { id: "p1", token, clientName: "Client A", active: true, sections: ["rams"] },
    ]);
    saveOrgScoped("rams_builder_docs", [{ id: "r1", title: "RAMS" }]);

    const supabase = { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } };
    const result = await republishPublishedPortals(supabase);
    expect(result.count).toBe(1);
    expect(publishPortalToCloud).toHaveBeenCalledTimes(1);
  });

  it("initPortalCloudAutoSync debounces republish on data save", async () => {
    vi.useFakeTimers();
    const token = "portal-token-xyz987654321";
    markPortalPublished(token);
    saveOrgScoped("client_portals", [
      { id: "p1", token, clientName: "Client B", active: true, sections: ["workers"] },
    ]);

    const supabase = { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } };
    const cleanup = initPortalCloudAutoSync(supabase);

    saveOrgScoped("mysafeops_workers", [{ id: "w1", name: "Worker" }]);
    expect(publishPortalToCloud).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4000);
    expect(publishPortalToCloud).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
