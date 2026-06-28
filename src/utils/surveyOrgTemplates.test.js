/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { getSurveyTypeTemplate, saveSurveyTypeTemplateOverride, resetSurveyTypeTemplateOverride } from "./surveyOrgTemplates";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("surveyOrgTemplates", () => {
  beforeEach(() => {
    saveOrgSettingsRaw({});
  });

  it("returns built-in template when no override", () => {
    const t = getSurveyTypeTemplate("utility_mapping_survey");
    expect(t?.scope).toMatch(/Utility mapping/i);
    expect(t?.methodology).toBeTruthy();
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

  it("reset removes override", () => {
    saveSurveyTypeTemplateOverride("gpr_survey", { scope: "Org GPR only." });
    resetSurveyTypeTemplateOverride("gpr_survey");
    const t = getSurveyTypeTemplate("gpr_survey");
    expect(t.scope).toMatch(/Ground penetrating radar/i);
  });
});
