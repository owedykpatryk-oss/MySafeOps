import { describe, it, expect } from "vitest";
import {
  SURVEY_CATALOG,
  getSurveyCatalogEntry,
  mergeRamsPackFromCatalog,
  catalogDefaultDeliverables,
  getPlaybookSurveyPack,
  isSurveySimpleMode,
} from "./surveyContentCatalog";

describe("surveyContentCatalog", () => {
  it("exposes catalog entries for core survey types", () => {
    expect(getSurveyCatalogEntry("utility_mapping_survey")?.scope).toMatch(/Utility mapping/i);
    expect(SURVEY_CATALOG.utility_mapping_survey.defaultDeliverables?.length).toBeGreaterThan(0);
  });

  it("merges RAMS pack prose from catalog", () => {
    const merged = mergeRamsPackFromCatalog({
      key: "utility_mapping_survey",
      label: "Old label",
      scope: "Old scope",
      method: "Old method",
    });
    expect(merged.scope).toMatch(/PAS128 QLB/i);
    expect(merged.method).toMatch(/pre-start/i);
    expect(merged.hazardTokens).toContain("utility");
  });

  it("builds deliverable rows with ids", () => {
    const rows = catalogDefaultDeliverables("eml_cat_survey");
    expect(rows?.length).toBeGreaterThan(0);
    expect(rows[0].id).toBeTruthy();
    expect(rows[0].description).toMatch(/report/i);
  });

  it("returns playbook survey pack shape", () => {
    const pack = getPlaybookSurveyPack("gpr_survey");
    expect(pack?.scope).toMatch(/GPR/i);
    expect(pack?.method).toBeTruthy();
  });

  it("defaults simple mode on unless explicitly disabled", () => {
    expect(isSurveySimpleMode({})).toBe(true);
    expect(isSurveySimpleMode({ surveySimpleMode: false })).toBe(false);
  });
});
