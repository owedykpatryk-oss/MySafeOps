import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn(async () => ({ error: null }));
const from = vi.fn(() => ({ upsert }));

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
import { mirrorPermitsToSupabase } from "./permitSupabaseMirror";

describe("permitSupabaseMirror workspace gating", () => {
  beforeEach(() => {
    upsert.mockClear();
    from.mockClear();
    vi.mocked(getCachedActiveCountryWorkspace).mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("skips cloud mirror when no country workspace is cached", async () => {
    vi.mocked(getCachedActiveCountryWorkspace).mockReturnValue(null);

    await mirrorPermitsToSupabase([{ id: "p1", status: "draft" }], "uk-org");

    expect(from).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[permits] cloud mirror skipped: no active country workspace.",
    );
  });

  it("upserts with workspace_id and workspace conflict key for an active UK workspace", async () => {
    vi.mocked(getCachedActiveCountryWorkspace).mockReturnValue({
      id: "11111111-1111-4111-8111-111111111111",
      market_id: "uk",
    });

    await mirrorPermitsToSupabase([{ id: "p-uk-1", status: "active", type: "hot_work" }], "uk-org");

    expect(from).toHaveBeenCalledWith("org_permits");
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: "user-1",
          org_slug: "uk-org",
          workspace_id: "11111111-1111-4111-8111-111111111111",
          permit_id: "p-uk-1",
        }),
      ],
      { onConflict: "user_id,workspace_id,permit_id" },
    );
  });
});
