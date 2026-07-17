/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { listWorkspaceProfilesForOrg } from "./customWorkspaceProfiles";
import { isValidIndustryPackId, applyIndustryPack, getAppliedIndustryPackId } from "./orgIndustryPacks";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { isUtilityMappingPrintTheme, utilityMappingSurveyCoverCss } from "./utilityMappingPrintTheme";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw, loadOrgSettingsRaw } from "./orgSettingsStorage";
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
