/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  RAMS_FEATURES,
  applyHidePreset,
  clearAllHidden,
  getHiddenFeatureIds,
  getHiddenModuleIds,
  hideFeature,
  hideModule,
  isFeatureVisible,
  isModuleVisible,
  unhideModule,
} from "./hiddenModules";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("hiddenModules", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("hides and unhides workspace modules", () => {
    expect(isModuleVisible("snags")).toBe(true);
    hideModule("snags");
    expect(getHiddenModuleIds()).toEqual(["snags"]);
    expect(isModuleVisible("snags")).toBe(false);
    expect(isModuleVisible("settings")).toBe(true);
    unhideModule("snags");
    expect(getHiddenModuleIds()).toEqual([]);
  });

  it("hides RAMS surveying feature", () => {
    hideFeature(RAMS_FEATURES.SURVEYING);
    expect(getHiddenFeatureIds()).toEqual([RAMS_FEATURES.SURVEYING]);
    expect(isFeatureVisible(RAMS_FEATURES.SURVEYING)).toBe(false);
    expect(isFeatureVisible(RAMS_FEATURES.ALLERGEN)).toBe(true);
  });

  it("applyHidePreset merges without clearing prior hides", () => {
    hideModule("incidents");
    applyHidePreset("hideSurveyingRams");
    expect(getHiddenModuleIds()).toContain("incidents");
    expect(getHiddenFeatureIds()).toContain(RAMS_FEATURES.SURVEYING);
  });

  it("clearAllHidden restores everything", () => {
    hideModule("coshh");
    hideFeature(RAMS_FEATURES.ALLERGEN);
    clearAllHidden();
    expect(getHiddenModuleIds()).toEqual([]);
    expect(getHiddenFeatureIds()).toEqual([]);
  });
});
