/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw, loadOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack, getAppliedIndustryPackId } from "./orgIndustryPacks";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";
import { getPlaybooksForOrg, getFeaturedPlaybooksForOrg } from "./projectHubIndustry";
import { getPlaybook } from "./projectPlaybooks";
import { getMsStepTemplate } from "./msOrgTemplates";
import { getSurveyTypeTemplate } from "./surveyOrgTemplates";
import { loadRamsHazardPacks } from "./ramsHazardPacksStorage";
import { UM_PAS128_BASELINE_PACK_DEF } from "./utilityMappingQuickPacks";
import { filterUtilityMappingExclusivePlaybooks, scrubUtilityMappingExclusiveOrgStorage } from "./utilityMappingExclusive";
import { listGeoPhotoPresetsForOrg, UM_PREFERRED_GEO_PHOTO_IDS } from "./geoPhotoPresets";
import { ensureOrgExclusiveQuickPacks, filterQuickPacksForOrg } from "../modules/rams/orgExclusiveQuickPacks.js";
import ALL from "../modules/rams/ramsAllHazards.js";

describe("Utility Mapping exclusive content", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org", hiddenModules: [], hiddenModulesBootstrapped: true });
  });

  it("hides UM playbooks from other orgs", () => {
    const ids = getPlaybooksForOrg().map((p) => p.id);
    expect(ids.some((id) => id.startsWith("um_"))).toBe(false);
    expect(
      filterUtilityMappingExclusivePlaybooks([{ id: "um_pas128_m2", orgExclusive: true }], "acme").length
    ).toBe(0);
  });

  it("lists UM playbooks and featured starters for Utility Mapping", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      industryPackId: UTILITY_MAPPING_PACK_ID,
      hiddenModules: [],
      hiddenModulesBootstrapped: true,
    });
    const ids = getPlaybooksForOrg().map((p) => p.id);
    expect(ids).toContain("um_pas128_m2");
    expect(ids).toContain("um_gpr_corridor");
    expect(getPlaybook("um_pas128_m2")?.pas128Method).toBe("M2");
    expect(getPlaybook("um_pas128_m2")?.msTemplate).toBe("pas128Mobilisation");
    const featured = getFeaturedPlaybooksForOrg(3).map((p) => p.id);
    expect(featured[0]).toMatch(/^um_/);
  });

  it("seeds exclusive packs, MS and survey defaults on pack apply", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      hiddenModules: ["survey-report"],
      hiddenModulesBootstrapped: true,
    });
    applyIndustryPack(UTILITY_MAPPING_PACK_ID, { seedTemplates: true });
    expect(getAppliedIndustryPackId()).toBe(UTILITY_MAPPING_PACK_ID);
    expect(loadRamsHazardPacks([]).some((p) => p.id === UM_PAS128_BASELINE_PACK_DEF.id)).toBe(true);
    expect(getMsStepTemplate("pas128Mobilisation").length).toBeGreaterThanOrEqual(6);
    const surveyTpl = getSurveyTypeTemplate("utility_mapping_survey");
    expect(surveyTpl?.methodology).toMatch(/Utility Mapping PAS128/);
    expect(loadOrgSettingsRaw().enabledPermitTypes).toContain("excavation");
  });

  it("filters UM packs for non-UM orgs and scrubs storage", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    const packs = ensureOrgExclusiveQuickPacks([], ALL, "utility-mapping");
    expect(packs.some((p) => p.id === UM_PAS128_BASELINE_PACK_DEF.id)).toBe(true);
    expect(filterQuickPacksForOrg(packs, "acme-ltd").some((p) => p.orgExclusive)).toBe(false);

    setOrgId("acme-ltd");
    saveOrgSettingsRaw({ name: "Acme", industryPackId: UTILITY_MAPPING_PACK_ID });
    scrubUtilityMappingExclusiveOrgStorage("acme-ltd");
    expect(loadOrgSettingsRaw().industryPackId).toBe("surveyingGeodesy");
  });

  it("orders geo-photo presets for Utility Mapping only", () => {
    const other = listGeoPhotoPresetsForOrg(false);
    const um = listGeoPhotoPresetsForOrg(true);
    expect(um[0].id).toBe(UM_PREFERRED_GEO_PHOTO_IDS[0]);
    expect(other.length).toBe(um.length);
  });
});
