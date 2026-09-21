import { describe, expect, it } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import { applySurveyAutofix, suggestSurveyAutofixes } from "./surveyAutofix";
import { getSpecialistFindingsConfig } from "./surveySpecialistFindings";

describe("surveyAutofix", () => {
  it("suggests records preset for utility mapping without records", () => {
    const report = blankSurveyReport({ surveyType: "utility_mapping_survey" });
    expect(suggestSurveyAutofixes(report)).toContain("records_pas128");
  });

  it("applies PAS128 records preset", () => {
    const report = blankSurveyReport({ surveyType: "utility_mapping_survey" });
    const next = applySurveyAutofix("records_pas128", report);
    expect(next?.utilityRecords?.sourcesConsulted?.length).toBeGreaterThan(0);
  });

  it("adds default deliverables when empty", () => {
    const report = blankSurveyReport({ surveyType: "utility_mapping_survey" });
    const next = applySurveyAutofix("deliverables_default", report);
    expect(next?.deliverables?.length).toBeGreaterThan(0);
  });

  it("suggests utilities_from_cad when CAD exists without schedule rows", () => {
    const report = blankSurveyReport({
      surveyType: "utility_mapping_survey",
      cadImport: {
        summary: [{ utilityKey: "gas", lengthM: 12, layers: ["UMG_GAS_B2"], pas128Equivalent: "B2" }],
      },
      utilitiesTable: [],
    });
    expect(suggestSurveyAutofixes(report)).toContain("utilities_from_cad");
  });
});

describe("surveySpecialistFindings", () => {
  it("returns CCTV config for drainage survey type", () => {
    const cfg = getSpecialistFindingsConfig("cctv_drainage_survey");
    expect(cfg?.tableKey).toBe("cctvRunsTable");
    expect(cfg?.columns.some((c) => c.key === "msccGrade")).toBe(true);
  });

  it("returns null for general survey", () => {
    expect(getSpecialistFindingsConfig("general_site_survey")).toBeNull();
  });
});
