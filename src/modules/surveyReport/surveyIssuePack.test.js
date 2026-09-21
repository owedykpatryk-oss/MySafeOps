import { describe, expect, it, vi } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import { applyAllSurveyAutofixes, syncLinkedGprIntoSurvey } from "./surveyIssuePack";

vi.mock("./surveyReportSmart", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runSmartFillAll: async (report) => ({ ...report, smartFillAt: "2026-01-01T00:00:00.000Z" }),
  };
});

describe("surveyIssuePack", () => {
  it("applies PAS128 records autofix for empty utility mapping", () => {
    const report = blankSurveyReport({ surveyType: "utility_mapping_survey" });
    const next = applyAllSurveyAutofixes(report);
    expect(next.utilityRecords?.sourcesConsulted?.length).toBeGreaterThan(0);
    expect(next.deliverables?.length).toBeGreaterThan(0);
  });

  it("syncs GPR anomalies into survey from project list", () => {
    const survey = blankSurveyReport({
      projectId: "p1",
      surveyType: "utility_mapping_survey",
      gprAnomalyCards: [],
    });
    const gprReports = [
      {
        id: "gpr1",
        projectId: "p1",
        ref: "GPR-1",
        anomalies: [{ id: "a1", ref: "A1", anomalyType: "utility", depthM: "0.9", interpretation: "Gas" }],
        sections: { findings: "One target." },
        radargrams: [],
      },
    ];
    const next = syncLinkedGprIntoSurvey(survey, gprReports);
    expect(next.linkedGprReportId).toBe("gpr1");
    expect(next.gprAnomalyCards.length).toBe(1);
  });
});
