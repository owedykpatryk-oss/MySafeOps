/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setOrgId, loadOrgScoped as load } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  FESS_CLIENT_SITE_TEMPLATES,
  getFessSitePlaybookSuggestion,
  listFessClientSiteTemplates,
  seedFessClientSiteProjects,
  ensureFessSiteProject,
} from "./fessClientSites";

describe("fessClientSites", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Test Org" });
  });

  it("exposes six client site templates from MC references", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    expect(listFessClientSiteTemplates()).toHaveLength(6);
    expect(FESS_CLIENT_SITE_TEMPLATES.some((t) => t.id === "fess_site_2sfg_scunthorpe")).toBe(true);
    expect(FESS_CLIENT_SITE_TEMPLATES.some((t) => t.id === "fess_site_dovecoat")).toBe(true);
  });

  it("does not seed projects for non-FESS orgs", () => {
    const result = seedFessClientSiteProjects();
    expect(result.created).toBe(0);
    expect(localStorage.getItem("mysafeops_projects")).toBeNull();
  });

  it("maps site templates to default FESS playbooks", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    expect(getFessSitePlaybookSuggestion("fess_site_butternut")?.playbookId).toBe("fess_spiral_conveyor");
    expect(getFessSitePlaybookSuggestion("fess_site_dovecoat")?.jobStarterKey).toBe("machine_install");
    expect(FESS_CLIENT_SITE_TEMPLATES.every((t) => t.suggestedPlaybookId)).toBe(true);
  });

  it("seeds FESS client site projects idempotently", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });

    const first = seedFessClientSiteProjects();
    expect(first.created).toBe(6);
    expect(first.names).toContain("2SFG Scunthorpe — production lines");

    const second = seedFessClientSiteProjects();
    expect(second.created).toBe(0);

    const projects = load("mysafeops_projects", []);
    expect(projects.filter((p) => p.fessSiteTemplateId).length).toBe(6);
    expect(projects.some((p) => p.playbookId === "fess_dolav_meyn")).toBe(true);
    expect(projects[0].nearestHospital).toMatch(/Hospital/i);
  });

  it("does not return a new site project when device storage refuses it", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (String(key).startsWith("mysafeops_projects_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    expect(ensureFessSiteProject("fess_site_quorn")).toBeNull();
    expect(seedFessClientSiteProjects()).toMatchObject({ created: 0, error: "storage_failed" });
    expect(load("mysafeops_projects", [])).toEqual([]);
  });
});
