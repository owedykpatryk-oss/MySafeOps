/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { applyIndustryPack } from "./orgIndustryPacks";
import { getHiddenModuleIds } from "./hiddenModules";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  getFeaturedPlaybooksForOrg,
  getPlaybooksForOrg,
  isSurveyWorkflowEnabled,
} from "./projectHubIndustry";

describe("projectHubIndustry", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("hides survey workflow for general contractor profile", () => {
    applyIndustryPack("generalContractor");
    expect(isSurveyWorkflowEnabled()).toBe(false);
    expect(getHiddenModuleIds()).toContain("survey-report");
  });

  it("enables survey workflow for geodesy profile", () => {
    applyIndustryPack("surveyingGeodesy");
    expect(isSurveyWorkflowEnabled()).toBe(true);
    expect(getHiddenModuleIds()).not.toContain("survey-report");
  });

  it("offers electrical playbook for electrical profile", () => {
    applyIndustryPack("electricalContractor");
    const featured = getFeaturedPlaybooksForOrg(2);
    expect(featured[0]?.id).toBe("electrical");
    expect(getPlaybooksForOrg().some((p) => p.id === "utility_mapping")).toBe(false);
  });

  it("hybrid contractor+surveying enables survey workflow and PAS128 playbooks", () => {
    applyIndustryPack("contractorPlusSurveying");
    expect(isSurveyWorkflowEnabled()).toBe(true);
    expect(getPlaybooksForOrg().some((p) => p.id === "utility_mapping")).toBe(true);
    expect(getHiddenModuleIds()).not.toContain("survey-report");
  });

  it("never exposes FESS playbooks to non-FESS orgs", () => {
    applyIndustryPack("generalContractor");
    expect(getPlaybooksForOrg().some((p) => String(p.id || "").startsWith("fess_"))).toBe(false);
  });
});
