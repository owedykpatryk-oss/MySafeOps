import { describe, expect, it } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import {
  filterSurveyReportsSearch,
  sortSurveyReports,
  summarizeSurveyReportList,
  surveyTabIsComplete,
} from "./surveyReportListUtils";

describe("surveyReportListUtils", () => {
  it("filters reports by search query", () => {
    const rows = [
      { id: "1", title: "Alpha mapping", ref: "SR-1" },
      { id: "2", title: "Beta GPR", ref: "SR-2", surveyor: "Alex" },
    ];
    expect(filterSurveyReportsSearch(rows, "alex")).toHaveLength(1);
    expect(filterSurveyReportsSearch(rows, "SR-1")).toHaveLength(1);
  });

  it("sorts by completeness", () => {
    const a = blankSurveyReport({ title: "A", surveyDate: "2026-01-01", surveyor: "X", surveyType: "utility_mapping_survey" });
    const b = blankSurveyReport({ ref: "only" });
    const sorted = sortSurveyReports([b, a], "complete");
    expect(sorted[0].title).toBe("A");
  });

  it("summarizes list stats", () => {
    const s = summarizeSurveyReportList([
      blankSurveyReport({ status: "draft" }),
      { ...blankSurveyReport({ status: "final" }), title: "Done", surveyDate: "2026-01-01", surveyor: "A", surveyType: "utility_mapping_survey" },
    ]);
    expect(s.total).toBe(2);
    expect(s.drafts).toBe(1);
    expect(s.finals).toBe(1);
  });

  it("marks details tab complete when core fields set", () => {
    const r = blankSurveyReport({
      title: "Test",
      surveyDate: "2026-04-01",
      surveyor: "Sam",
      surveyType: "utility_mapping_survey",
      siteAddress: "Site 1",
    });
    expect(surveyTabIsComplete(r, "details")).toBe(true);
    expect(surveyTabIsComplete(blankSurveyReport(), "details")).toBe(false);
  });
});
