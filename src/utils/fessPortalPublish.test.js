/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { seedFessSitePortals } from "./fessPortalPreset";
import {
  getFessPortalPublishStatus,
  publishFessPortalToCloud,
  publishAllFessSitePortals,
} from "./fessPortalPublish";
import { loadPublishedPortalTokens } from "./clientPortalPublished";

vi.mock("./orgMembership", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    syncOrgSlugIfNeeded: vi.fn(async () => "fess-group"),
  };
});

vi.mock("./clientPortalCloud", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    publishPortalToCloud: vi.fn(async () => ({ ok: true })),
  };
});

describe("fessPortalPublish", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    seedFessSitePortals();
  });

  it("reports unpublished FESS portals", () => {
    const status = getFessPortalPublishStatus();
    expect(status.total).toBeGreaterThan(0);
    expect(status.unpublished).toBe(status.total);
  });

  it("marks portal published after cloud publish", async () => {
    const status = getFessPortalPublishStatus();
    const portal = status.portals[0];
    const result = await publishFessPortalToCloud({ auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } }, portal);
    expect(result.ok).toBe(true);
    expect(loadPublishedPortalTokens().has(portal.token)).toBe(true);
  });

  it("publishes all FESS site portals", async () => {
    const supabase = { auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } };
    const result = await publishAllFessSitePortals(supabase);
    expect(result.published).toBeGreaterThan(0);
    expect(getFessPortalPublishStatus().unpublished).toBe(0);
  });
});
