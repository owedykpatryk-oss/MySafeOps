/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { setOrgId, saveOrgScoped } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { runFessTodayOnSite } from "./fessTodayOnSite";
import { listFessClientSiteTemplates } from "./fessClientSites";

vi.mock("./workspaceNavContext", () => ({
  openWorkspaceView: vi.fn(),
  setWorkspaceNavTarget: vi.fn(),
}));

describe("fessTodayOnSite", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", hiddenModulesBootstrapped: true });
    saveOrgScoped("mysafeops_projects", []);
    saveOrgScoped("ghp_register", []);
    saveOrgScoped("loto_register", []);
    saveOrgScoped("emergency_contacts", []);
    saveOrgScoped("daily_briefings", []);
  });

  it("returns error for non-FESS org", () => {
    setOrgId("acme");
    saveOrgSettingsRaw({ name: "Acme" });
    expect(runFessTodayOnSite("x").ok).toBe(false);
  });

  it("mobilises and opens daily briefing for a known site", async () => {
    const { openWorkspaceView, setWorkspaceNavTarget } = await import("./workspaceNavContext");
    const site = listFessClientSiteTemplates()[0];
    expect(site?.id).toBeTruthy();
    const result = runFessTodayOnSite(site.id);
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/today ready|mobilised/i);
    expect(setWorkspaceNavTarget).toHaveBeenCalled();
    expect(openWorkspaceView).toHaveBeenCalledWith({ viewId: "daily-briefing" });
  });

  it("can open Photos instead of briefing", async () => {
    const { openWorkspaceView } = await import("./workspaceNavContext");
    const site = listFessClientSiteTemplates()[0];
    const result = runFessTodayOnSite(site.id, { openPhotos: true });
    expect(result.ok).toBe(true);
    expect(result.opened).toBe("geo-photos");
    expect(openWorkspaceView).toHaveBeenCalledWith({ viewId: "geo-photos" });
  });
});
