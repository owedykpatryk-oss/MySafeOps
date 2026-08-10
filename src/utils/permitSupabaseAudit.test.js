import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn(async () => ({ error: null }));
const from = vi.fn(() => ({ insert }));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      })),
    },
    from: (...args) => from(...args),
  },
}));

vi.mock("./orgStorage", () => ({
  getOrgId: vi.fn(() => "uk-org"),
}));

vi.mock("./countryWorkspaces", () => ({
  getCachedActiveCountryWorkspace: vi.fn(),
}));

import { getCachedActiveCountryWorkspace } from "./countryWorkspaces";
import {
  exportPermitAuditCsvViaServer,
  logPermitAuditToSupabase,
  logPermitDeletedToSupabase,
} from "./permitSupabaseAudit";

describe("permitSupabaseAudit workspace gating", () => {
  beforeEach(() => {
    insert.mockClear();
    from.mockClear();
    vi.mocked(getCachedActiveCountryWorkspace).mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("skips cloud audit insert when no country workspace is cached", async () => {
    vi.mocked(getCachedActiveCountryWorkspace).mockReturnValue(null);

    await logPermitAuditToSupabase(null, { id: "p1", status: "draft", type: "hot_work" }, "uk-org");
    await logPermitDeletedToSupabase({ id: "p1", status: "draft" }, "uk-org");

    expect(from).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[permits] cloud audit skipped: no active country workspace.",
    );
    expect(console.warn).toHaveBeenCalledWith(
      "[permits] cloud audit (delete) skipped: no active country workspace.",
    );
  });

  it("writes workspace_id on cloud audit insert for an active UK workspace", async () => {
    vi.mocked(getCachedActiveCountryWorkspace).mockReturnValue({
      id: "11111111-1111-4111-8111-111111111111",
      market_id: "uk",
    });

    await logPermitAuditToSupabase(
      null,
      { id: "p-uk-1", status: "active", type: "hot_work", location: "Plant room" },
      "uk-org",
    );

    expect(from).toHaveBeenCalledWith("org_permit_audit");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_slug: "uk-org",
        workspace_id: "11111111-1111-4111-8111-111111111111",
        permit_id: "p-uk-1",
        action: "created",
      }),
    );
  });

  it("requires a country workspace before server CSV export", async () => {
    vi.mocked(getCachedActiveCountryWorkspace).mockReturnValue(null);
    await expect(exportPermitAuditCsvViaServer({ orgSlug: "uk-org" })).rejects.toThrow(
      /Select a country workspace/,
    );
  });
});
