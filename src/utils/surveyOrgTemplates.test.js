/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getSurveyTypeTemplate,
  saveSurveyTypeTemplateOverride,
  resetSurveyTypeTemplateOverride,
  isSurveySimpleMode,
  setSurveySimpleMode,
} from "./surveyOrgTemplates";
import { saveOrgSettingsRaw, loadOrgSettingsRaw } from "./orgSettingsStorage";

describe("surveyOrgTemplates", () => {
  beforeEach(() => {
    saveOrgSettingsRaw({});
  });

  it("returns built-in template when no override", () => {
    const t = getSurveyTypeTemplate("utility_mapping_survey");
    expect(t?.scope).toMatch(/Utility mapping/i);
    expect(t?.methodology).toBeTruthy();
    expect(t?.defaultLimitationKeys?.length).toBeGreaterThan(0);
  });

  it("merges org override over built-in", () => {
    saveSurveyTypeTemplateOverride("topographical_survey", {
      scope: "Custom org scope for topo.",
      methodology: "Custom method.",
    });
    const t = getSurveyTypeTemplate("topographical_survey");
    expect(t.scope).toBe("Custom org scope for topo.");
    expect(t.equipmentUsed).toMatch(/total station/i);
  });

  it("merges extended prebuild fields from org", () => {
    saveSurveyTypeTemplateOverride("gpr_survey", {
      recordsBoilerplate: "Org records text.",
      executiveSummaryTemplate: "GPR at {site} on {date}.",
      defaultLimitationKeys: ["weather_impact"],
      defaultDeliverables: [{ format: "report_pdf", description: "Org PDF only" }],
    });
    const t = getSurveyTypeTemplate("gpr_survey");
    expect(t.recordsBoilerplate).toBe("Org records text.");
    expect(t.executiveSummaryTemplate).toMatch(/\{site\}/);
    expect(t.defaultLimitationKeys).toEqual(["weather_impact"]);
    expect(t.defaultDeliverables[0].description).toBe("Org PDF only");
  });

  it("reset removes override", () => {
    saveSurveyTypeTemplateOverride("gpr_survey", { scope: "Org GPR only." });
    resetSurveyTypeTemplateOverride("gpr_survey");
    const t = getSurveyTypeTemplate("gpr_survey");
    expect(t.scope).toMatch(/Ground penetrating radar/i);
  });

  it("persists simple survey mode preference", () => {
    expect(isSurveySimpleMode({})).toBe(true);
    setSurveySimpleMode(false);
    expect(isSurveySimpleMode(loadOrgSettingsRaw())).toBe(false);
    setSurveySimpleMode(true);
    expect(isSurveySimpleMode(loadOrgSettingsRaw())).toBe(true);
  });
});
