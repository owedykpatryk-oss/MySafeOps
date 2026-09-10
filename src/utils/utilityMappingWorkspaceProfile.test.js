/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { listWorkspaceProfilesForOrg } from "./customWorkspaceProfiles";
import { isValidIndustryPackId, applyIndustryPack, getAppliedIndustryPackId } from "./orgIndustryPacks";
import {
  UTILITY_MAPPING_PACK_ID,
  UTILITY_MAPPING_ORG_SLUGS,
  getUtilityMappingWorkspacePack,
  isUtilityMappingOrgForWorkspaceList,
} from "./utilityMappingWorkspaceProfile";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { isUtilityMappingPrintTheme, utilityMappingSurveyCoverCss } from "./utilityMappingPrintTheme";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw, loadOrgSettingsRaw } from "./orgSettingsStorage";
import { COUNTRY_WORKSPACE_MARKETS } from "./countryWorkspaces";
import { getHiddenFeatureIds, RAMS_FEATURES } from "./hiddenModules";
import { PACK_DEFAULT_PERMIT_TYPES } from "../modules/permits/permitPackDefaults";
import { buildSurveyReportHtml } from "../modules/surveyReport/surveyReportPrintHtml";

describe("Utility Mapping exclusive workspace profile", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org", hiddenModules: [], hiddenModulesBootstrapped: true });
  });

  it("lists utilityMapping profile only for Utility Mapping org", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      hiddenModules: [],
      hiddenModulesBootstrapped: true,
    });
    const ids = listWorkspaceProfilesForOrg().map((p) => p.id);
    expect(ids).toContain(UTILITY_MAPPING_PACK_ID);
    expect(isUtilityMappingOrg()).toBe(true);
  });

  it("detects Utility Mapping by org slug allowlist only", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Anything", website: "https://evil.example", hiddenModules: [] });
    expect(isUtilityMappingOrg()).toBe(true);
  });

  it("treats the live auto-provisioned u-map tenant slug as Utility Mapping", () => {
    setOrgId("patryk-44bdf196");
    saveOrgSettingsRaw({ name: "Patryk Workspace", hiddenModules: [] });
    expect(isUtilityMappingOrg()).toBe(true);
    expect(listWorkspaceProfilesForOrg().map((p) => p.id)).toContain(UTILITY_MAPPING_PACK_ID);
  });

  it("enables PAS128 survey, RAMS and permit-to-dig modules for the live u-map tenant", () => {
    setOrgId("patryk-44bdf196");
    saveOrgSettingsRaw({ name: "Patryk Workspace", hiddenModules: [], hiddenModulesBootstrapped: true });
    expect(isUtilityMappingOrg()).toBe(true);
    const pack = getUtilityMappingWorkspacePack();
    expect(pack.showModules).toEqual(
      expect.arrayContaining([
        "survey-report",
        "gpr-report",
        "geo-photos",
        "rams",
        "permits",
        "method-statement",
        "daily-briefing",
        "construction-setup",
      ])
    );
    expect(pack.hiddenModules).toEqual(
      expect.arrayContaining(["allergen-changeovers", "fess-setup", "electrical-pat", "plant"])
    );
    expect(pack.orgExclusive).toBe(true);
    expect(pack.ramsStarterKey).toBe("geospatial_intelligence");
    expect(pack.surveyWorkflow).toBe(true);
  });

  it("resolves every allowlist slug after hyphen normalisation", () => {
    expect(UTILITY_MAPPING_ORG_SLUGS.has("patryk-44bdf196")).toBe(true);
    for (const raw of UTILITY_MAPPING_ORG_SLUGS) {
      expect(isUtilityMappingOrgForWorkspaceList(raw)).toBe(true);
      expect(isUtilityMappingOrgForWorkspaceList(String(raw).replace(/_/g, "-"))).toBe(true);
    }
  });

  it("rejects website / email spoof without allowlisted slug", () => {
    setOrgId("acme-surveys");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      email: "patryk@u-map.co.uk",
      hiddenModules: [],
    });
    expect(isUtilityMappingOrg()).toBe(false);
  });

  it("does not treat country workspace market ids as Utility Mapping orgs", () => {
    expect(COUNTRY_WORKSPACE_MARKETS.length).toBeGreaterThan(0);
    expect(COUNTRY_WORKSPACE_MARKETS).toEqual(expect.arrayContaining(["uk", "pl", "au"]));
    // DACH ids live on feat/geo-photo-type-fields; lock them even before this branch rebases.
    const dachMarkets = ["de", "at", "ch"];
    for (const market of [...COUNTRY_WORKSPACE_MARKETS, ...dachMarkets]) {
      expect(isUtilityMappingOrgForWorkspaceList(market)).toBe(false);
    }
  });

  it("applies the exclusive pack to the live u-map tenant including permit-to-dig", () => {
    setOrgId("patryk-44bdf196");
    saveOrgSettingsRaw({ name: "Patryk Workspace", hiddenModules: [], hiddenModulesBootstrapped: true });
    expect(isUtilityMappingOrg()).toBe(true);
    applyIndustryPack(UTILITY_MAPPING_PACK_ID, { seedTemplates: false });
    expect(getAppliedIndustryPackId()).toBe(UTILITY_MAPPING_PACK_ID);
    const settings = loadOrgSettingsRaw();
    // PAS128 / permit-to-dig set — excavation + ground disturbance, not a GC hot-work pack.
    expect(settings.enabledPermitTypes).toEqual(
      expect.arrayContaining(["excavation", "ground_disturbance", "visitor_access", "general"])
    );
    expect(settings.enabledPermitTypes).not.toContain("hot_work");
    expect(settings.hiddenModules).toEqual(
      expect.arrayContaining(["allergen-changeovers", "fess-setup", "fess-sites", "asbestos", "electrical-pat", "plant"])
    );
    expect(settings.hiddenModules).not.toContain("survey-report");
    expect(settings.hiddenModules).not.toContain("gpr-report");
    expect(settings.hiddenModules).not.toContain("geo-photos");
    expect(settings.hiddenModules).not.toContain("rams");
    expect(settings.hiddenModules).not.toContain("permits");
    expect(settings.hiddenModules).not.toContain("method-statement");
    expect(settings.hiddenModules).not.toContain("daily-briefing");
    expect(settings.hiddenModules).not.toContain("construction-setup");
    expect(settings.ramsStarterKey).toBe("geospatial_intelligence");
    expect(settings.enabledPermitTypes).toEqual(PACK_DEFAULT_PERMIT_TYPES.utilityMapping);
    // surveyingFocus hides food RAMS, not PAS128 surveying packs.
    expect(getHiddenFeatureIds()).toContain(RAMS_FEATURES.ALLERGEN);
    expect(getHiddenFeatureIds()).not.toContain(RAMS_FEATURES.SURVEYING);
  });

  it("hides utilityMapping profile from other orgs", () => {
    const ids = listWorkspaceProfilesForOrg().map((p) => p.id);
    expect(ids).not.toContain(UTILITY_MAPPING_PACK_ID);
    expect(isValidIndustryPackId(UTILITY_MAPPING_PACK_ID)).toBe(false);
    expect(isUtilityMappingPrintTheme()).toBe(false);
  });

  it("applies utilityMapping profile and seeds navy/cyan branding", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      hiddenModules: ["survey-report", "gpr-report"],
      hiddenModulesBootstrapped: true,
    });
    applyIndustryPack(UTILITY_MAPPING_PACK_ID, { seedTemplates: false });
    expect(getAppliedIndustryPackId()).toBe(UTILITY_MAPPING_PACK_ID);
    const settings = loadOrgSettingsRaw();
    expect(settings.primaryColor).toBe("#0B1D3A");
    expect(settings.accentColor).toBe("#00B4E4");
    expect(settings.enabledPermitTypes).toContain("excavation");
    expect(settings.hiddenModules).not.toContain("survey-report");
    expect(settings.hiddenModules).not.toContain("gpr-report");
    expect(settings.hiddenModules).not.toContain("geo-photos");
  });

  it("uses exclusive PAS128 hero cover only for Utility Mapping", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      primaryColor: "#0B1D3A",
      accentColor: "#00B4E4",
      hiddenModules: [],
      hiddenModulesBootstrapped: true,
    });
    expect(utilityMappingSurveyCoverCss()).toMatch(/sr-cover--um/);
    const html = buildSurveyReportHtml({
      title: "PAS128 M2 Utility Survey Report",
      ref: "UM26-TEST",
      status: "draft",
      surveyType: "utility_mapping_survey",
    });
    expect(html).toContain("um-hero-cover");
    expect(html).toContain("/branding/utility-mapping/cover-hero.jpg");
    expect(html).toContain("/branding/utility-mapping-logo.png");
    expect(html).toContain("#0B1D3A");
  });

  it("does not inject Utility Mapping cover for other orgs", () => {
    const html = buildSurveyReportHtml({
      title: "Survey Report",
      ref: "SR-1",
      status: "draft",
    });
    expect(html).not.toContain("um-hero-cover");
    expect(html).not.toContain("cover-hero.jpg");
  });
});
