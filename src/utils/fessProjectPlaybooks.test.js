/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { FESS_PROJECT_PLAYBOOKS, getFessPlaybook } from "./fessProjectPlaybooks";
import { applyIndustryPack } from "./orgIndustryPacks";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { getPlaybooksForOrg, getFeaturedPlaybooksForOrg } from "./projectHubIndustry";
import { createRamsDraftFromPlaybook, getPlaybook } from "./projectPlaybooks";

describe("fessProjectPlaybooks", () => {
  const project = {
    id: "proj_fess",
    name: "2SFG Scunthorpe — production lines",
    client: "2 Sisters Food Group",
    address: "2SFG Scunthorpe, UK",
  };

  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", industryPackId: "fessGroup" });
    applyIndustryPack("fessGroup");
  });

  it("maps MC job starters to org-exclusive playbooks", () => {
    expect(FESS_PROJECT_PLAYBOOKS).toHaveLength(19);
    expect(getFessPlaybook("fess_dolav_meyn")?.fessJobStarterKey).toBe("dolav_meyn");
    expect(getFessPlaybook("fess_unknown")).toBeNull();
  });

  it("surfaces FESS playbooks in project hub for FESS org", () => {
    const playbooks = getPlaybooksForOrg();
    expect(playbooks.some((p) => p.id === "fess_spiral_conveyor")).toBe(true);
    expect(playbooks.filter((p) => p.orgExclusive).length).toBeGreaterThanOrEqual(19);
  });

  it("features food factory playbooks for fessGroup profile", () => {
    const featured = getFeaturedPlaybooksForOrg(3);
    expect(featured[0]?.id).toBe("fess_dolav_meyn");
  });

  it("creates RAMS draft with starter fields and hazard rows", () => {
    const pb = getPlaybook("fess_tank_relocation");
    const rams = createRamsDraftFromPlaybook(project, pb);
    expect(rams.fessJobStarterKey).toBe("tank_relocation");
    expect(rams.title).toMatch(/tank/i);
    expect(rams.surveyMethodStatement).toMatch(/Relocate/i);
    expect(rams.rows.length).toBeGreaterThan(20);
  });
});
