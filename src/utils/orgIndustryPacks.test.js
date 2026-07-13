/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { RAMS_FEATURES } from "./hiddenModules";
import { getHiddenFeatureIds, getHiddenModuleIds } from "./hiddenModules";
import { applyIndustryPack, getAppliedIndustryPackId, INDUSTRY_PACKS } from "./orgIndustryPacks";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("orgIndustryPacks", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("defines expected workspace profiles", () => {
    expect(Object.keys(INDUSTRY_PACKS)).toEqual([
      "generalContractor",
      "electricalContractor",
      "buildingTrades",
      "surveyingGeodesy",
      "contractorPlusSurveying",
      "facilitiesMaintenance",
      "demolitionStripout",
      "civilEarthworks",
      "foodPharma",
      "showEverything",
    ]);
  });

  it("general contractor hides survey-report module", () => {
    applyIndustryPack("generalContractor");
    expect(getAppliedIndustryPackId()).toBe("generalContractor");
    expect(getHiddenModuleIds()).toContain("survey-report");
  });

  it("applyIndustryPack stores pack id and sectors", () => {
    applyIndustryPack("foodPharma");
    expect(getAppliedIndustryPackId()).toBe("foodPharma");
    expect(loadOrgSettingsRaw().industrySectors).toContain("pharma");
    expect(getHiddenFeatureIds()).toContain(RAMS_FEATURES.SURVEYING);
  });

  it("surveying pack hides allergen RAMS block", () => {
    applyIndustryPack("surveyingGeodesy");
    expect(getAppliedIndustryPackId()).toBe("surveyingGeodesy");
    expect(getHiddenFeatureIds()).toContain(RAMS_FEATURES.ALLERGEN);
  });

  it("showEverything only records pack without hides", () => {
    applyIndustryPack("showEverything");
    expect(getAppliedIndustryPackId()).toBe("showEverything");
    expect(getHiddenModuleIds()).toEqual([]);
    expect(getHiddenFeatureIds()).toEqual([]);
  });

  it("foodPharma pack unhides hygiene registers", () => {
    applyIndustryPack("foodPharma");
    expect(getHiddenModuleIds()).not.toContain("allergen-changeovers");
    expect(getHiddenModuleIds()).not.toContain("gmp-deviations");
  });

  it("civil earthworks pack surfaces excavation modules", () => {
    applyIndustryPack("civilEarthworks");
    expect(getAppliedIndustryPackId()).toBe("civilEarthworks");
    expect(getHiddenModuleIds()).not.toContain("excavation");
    expect(loadOrgSettingsRaw().ramsStarterKey).toBe("groundworks");
  });

  it("rejects invalid pack keys", () => {
    applyIndustryPack("__proto__");
    applyIndustryPack("not-a-pack");
    expect(getAppliedIndustryPackId()).toBeNull();
  });
});
