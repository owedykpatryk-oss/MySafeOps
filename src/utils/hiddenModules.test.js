/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import BillingReadOnlyBanner from "../components/BillingReadOnlyBanner";
import {
  RAMS_FEATURES,
  applyHidePreset,
  clearAllHidden,
  getHiddenFeatureIds,
  getHiddenModuleIds,
  hasFullModuleEntitlement,
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
    saveOrgSettingsRaw({ hiddenModules: [], hiddenModulesBootstrapped: true });
  });

  it("stores hidden modules in org settings", () => {
    const endsAt = new Date(Date.now() + 7 * 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", endsAt);
    hideModule("snags");
    expect(getHiddenModuleIds()).toEqual(["snags"]);
    expect(isModuleVisible("snags")).toBe(true);
    unhideModule("snags");
    expect(getHiddenModuleIds()).toEqual([]);
  });

  it("stores hidden RAMS features in org settings", () => {
    const endsAt = new Date(Date.now() + 7 * 86400000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", endsAt);
    hideFeature(RAMS_FEATURES.SURVEYING);
    expect(getHiddenFeatureIds()).toEqual([RAMS_FEATURES.SURVEYING]);
    expect(isFeatureVisible(RAMS_FEATURES.SURVEYING)).toBe(true);
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

  it("active org trial shows hidden modules and RAMS features", () => {
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", endsAt);
    hideModule("snags");
    hideFeature(RAMS_FEATURES.SURVEYING);
    expect(isModuleVisible("snags")).toBe(true);
    expect(isFeatureVisible(RAMS_FEATURES.SURVEYING)).toBe(true);
    expect(getHiddenModuleIds()).toEqual(["snags"]);
  });

  it("expired trial respects hidden modules again", () => {
    hideModule("snags");
    const endsAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", endsAt);
    expect(isModuleVisible("snags")).toBe(false);
  });

  it("deferred AI modules stay hidden during trial", () => {
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem("mysafeops_trial_ends_at", endsAt);
    expect(isModuleVisible("ai-rams")).toBe(false);
  });

  it("paid subscription shows modules hidden by slim bootstrap", () => {
    hideModule("gmp-deviations");
    localStorage.setItem("mysafeops_trial_ends_at", new Date(Date.now() - 86400000).toISOString());
    localStorage.setItem("mysafeops_subscription_status", "active");
    localStorage.setItem("mysafeops_billing_plan", "starter");
    expect(hasFullModuleEntitlement()).toBe(true);
    expect(isModuleVisible("gmp-deviations")).toBe(true);
  });

  it("local workspace without trial metadata shows all modules", () => {
    hideModule("survey-report");
    expect(hasFullModuleEntitlement()).toBe(true);
    expect(isModuleVisible("survey-report")).toBe(true);
  });
});
