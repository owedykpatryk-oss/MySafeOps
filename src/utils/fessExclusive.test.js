/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  filterFessExclusivePlaybooks,
  filterHazardLibraryForOrg,
  isFessExclusivePlaybookId,
  sanitizeRamsDocForOrg,
  sanitizeMsDocForOrg,
  sanitizeProjectForOrg,
  scrubFessExclusiveOrgStorage,
  stripFessRamsFields,
} from "./fessExclusive";
import { saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { loadRamsHazardPacks, RAMS_HAZARD_PACKS_KEY } from "./ramsHazardPacksStorage";
import { listFessJobStarters, getFessJobStarter } from "./fessJobStarters";
import { getFessPlaybook } from "./fessProjectPlaybooks";
import { listFessClientSiteTemplates } from "./fessClientSites";
import { buildFessMethodStatementPackHtml } from "./fessMsPrintHtml";
import { getPlaybooksForOrg } from "./projectHubIndustry";

describe("fessExclusive", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("acme-ltd");
    saveOrgSettingsRaw({ name: "Acme Contractors Ltd" });
  });

  it("detects FESS-exclusive playbook ids", () => {
    expect(isFessExclusivePlaybookId("fess_dolav_meyn")).toBe(true);
    expect(isFessExclusivePlaybookId("general")).toBe(false);
  });

  it("filters FESS playbooks for non-FESS orgs", () => {
    const filtered = filterFessExclusivePlaybooks([
      { id: "general", orgExclusive: false },
      { id: "fess_dolav_meyn", orgExclusive: true },
    ]);
    expect(filtered.map((p) => p.id)).toEqual(["general"]);
  });

  it("strips FESS RAMS fields on save for non-FESS org", () => {
    const doc = sanitizeRamsDocForOrg(
      { title: "RAMS", fessJobStarterKey: "dolav_meyn", permitControllerName: "Site PC" },
      "acme-ltd"
    );
    expect(doc.fessJobStarterKey).toBeUndefined();
    expect(doc.permitControllerName).toBeUndefined();
    expect(doc.title).toBe("RAMS");
  });

  it("keeps FESS RAMS fields for FESS org", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    const doc = sanitizeRamsDocForOrg({ fessJobStarterKey: "dolav_meyn" }, "fess-group");
    expect(doc.fessJobStarterKey).toBe("dolav_meyn");
  });

  it("sanitizes MS and project records for non-FESS org", () => {
    const ms = sanitizeMsDocForOrg({ title: "MS", permitControllerName: "PC" }, "acme-ltd");
    expect(ms.permitControllerName).toBeUndefined();
    const project = sanitizeProjectForOrg(
      { name: "Site", playbookId: "fess_dolav_meyn", fessSiteTemplateId: "fess_site_quorn" },
      "acme-ltd"
    );
    expect(project.playbookId).toBe("general");
    expect(project.fessSiteTemplateId).toBeUndefined();
  });

  it("blocks FESS APIs for non-FESS orgs", () => {
    expect(listFessJobStarters()).toEqual([]);
    expect(getFessJobStarter("dolav_meyn")).toBeNull();
    expect(getFessPlaybook("fess_dolav_meyn")).toBeNull();
    expect(listFessClientSiteTemplates()).toEqual([]);
    expect(buildFessMethodStatementPackHtml({ title: "x" }, [], [], null)).toBe("");
    expect(getPlaybooksForOrg().some((p) => p.id.startsWith("fess_"))).toBe(false);
  });

  it("allows FESS APIs for FESS org", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", industryPackId: "fessGroup" });
    expect(listFessJobStarters().length).toBe(19);
    expect(getPlaybooksForOrg().some((p) => p.id === "fess_dolav_meyn")).toBe(true);
  });

  it("stripFessRamsFields removes only FESS keys", () => {
    const next = stripFessRamsFields({ title: "A", fessJobStarterLabel: "B", rows: [] });
    expect(next.title).toBe("A");
    expect(next.rows).toEqual([]);
    expect(next.fessJobStarterLabel).toBeUndefined();
  });

  it("filters fess_ hazard ids from library for non-FESS org", () => {
    const lib = [{ id: "gen_001" }, { id: "fess_001" }];
    expect(filterHazardLibraryForOrg(lib, "acme-ltd").map((h) => h.id)).toEqual(["gen_001"]);
    setOrgId("fess-group");
    expect(filterHazardLibraryForOrg(lib, "fess-group").map((h) => h.id)).toEqual(["gen_001", "fess_001"]);
  });

  it("scrubs FESS storage artifacts for non-FESS org", () => {
    saveOrgSettingsRaw({ name: "Acme Ltd", industryPackId: "fessGroup" });
    save("mysafeops_projects", [
      { id: "p1", name: "2SFG", playbookId: "fess_dolav_meyn", fessSiteTemplateId: "fess_site_quorn" },
    ]);
    save("rams_builder_docs", [{ id: "r1", fessJobStarterKey: "dolav_meyn", permitControllerName: "PC" }]);
    save(RAMS_HAZARD_PACKS_KEY, [{ id: "orgexclusive_fess_me_site_baseline", orgExclusive: true }]);

    const result = scrubFessExclusiveOrgStorage("acme-ltd");
    expect(result.scrubbed).toBe(true);
    expect(result.changes).toContain("industryPackId");
    expect(result.changes).toContain("projects");
    expect(result.changes).toContain("hazardPacks");

    const projects = JSON.parse(localStorage.getItem("mysafeops_projects_acme-ltd"));
    expect(projects[0].fessSiteTemplateId).toBeUndefined();
    expect(projects[0].playbookId).toBe("general");
    expect(loadOrgSettingsRaw().industryPackId).toBe("generalContractor");
    expect(loadRamsHazardPacks([]).some((p) => p.orgExclusive)).toBe(false);
  });

  it("removes FESS portal presets for non-FESS org", () => {
    save("client_portals", [
      { id: "p1", clientName: "2SFG", fessPortalPreset: true, fessSiteTemplateId: "fess_site_quorn" },
      { id: "p2", clientName: "Generic client" },
    ]);
    scrubFessExclusiveOrgStorage("acme-ltd");
    const portals = JSON.parse(localStorage.getItem("client_portals_acme-ltd"));
    expect(portals.length).toBe(1);
    expect(portals[0].clientName).toBe("Generic client");
  });
});
