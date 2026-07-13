import { describe, it, expect } from "vitest";
import {
  SURVEY_CATALOG,
  getSurveyCatalogEntry,
  mergeRamsPackFromCatalog,
  catalogDefaultDeliverables,
  getPlaybookSurveyPack,
  isSurveySimpleMode,
  buildSurveyRamsMethod,
  PAS128_QL_TOLERANCES,
  formatPas128QlToleranceProse,
  pas128QlToleranceHtmlTable,
  getSurveyPackMeta,
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
    expect(merged.scope).toMatch(/PAS 128 QL-B/i);
    expect(merged.method).toMatch(/pre-project meeting/i);
    expect(merged.method).toMatch(/Management arrangements/i);
    expect(merged.hazardTokens).toContain("utility");
  });

  it("includes new drainage connectivity and service clearance types", () => {
    expect(getSurveyCatalogEntry("drainage_connectivity_survey")?.scope).toMatch(/sonde/i);
    expect(getSurveyCatalogEntry("service_clearance_survey")?.scope).toMatch(/clearance/i);
    expect(SURVEY_CATALOG.drainage_connectivity_survey.defaultDeliverables?.length).toBeGreaterThan(0);
  });

  it("appends shared RAMS management block to playbook packs", () => {
    const pack = getPlaybookSurveyPack("gpr_survey");
    expect(pack?.method).toMatch(/4\.0 Work procedure/i);
    expect(pack?.method).toMatch(/5\.0 Management arrangements/i);
    expect(pack?.packMeta?.holdPoints?.length).toBeGreaterThan(0);
  });

  it("exposes PAS128 QL tolerance reference", () => {
    expect(PAS128_QL_TOLERANCES.some((r) => r.key === "B1")).toBe(true);
    expect(formatPas128QlToleranceProse()).toMatch(/QL B1/i);
    expect(pas128QlToleranceHtmlTable()).toMatch(/<table/i);
  });

  it("includes topo plus utility combined type", () => {
    const entry = getSurveyCatalogEntry("topo_plus_utility_survey");
    expect(entry?.scope).toMatch(/Combined topographical/i);
    expect(getSurveyPackMeta("topo_plus_utility_survey").defaultPas128Method).toBe("M2P");
  });

  it("buildSurveyRamsMethod uses structured UMG sections", () => {
    const method = buildSurveyRamsMethod("1. Task step.");
    expect(method).toMatch(/4\.5 Safe work procedure/i);
    expect(method).toMatch(/1\. Task step\./);
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
