/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId, loadOrgScoped as load } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  FESS_CLIENT_SITE_TEMPLATES,
  getFessSitePlaybookSuggestion,
  listFessClientSiteTemplates,
  seedFessClientSiteProjects,
} from "./fessClientSites";

describe("fessClientSites", () => {
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
});
