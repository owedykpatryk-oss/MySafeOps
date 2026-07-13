import { describe, expect, it } from "vitest";
import { surveyListFilterCounts } from "./surveyListFilterCounts";
import { blankSurveyReport } from "./surveyReportConstants";

describe("surveyListFilterCounts", () => {
  it("counts drafts, finals and ready", () => {
    const draft = blankSurveyReport({
      title: "A",
      surveyDate: "2026-01-01",
      surveyor: "Sam",
      surveyType: "utility_mapping_survey",
      siteAddress: "Site",
      sections: { scope: "x", methodology: "y", findings: "z", executiveSummary: "e", recommendations: "r" },
    });
    const counts = surveyListFilterCounts([
      draft,
      { ...blankSurveyReport({ status: "final" }), title: "F", surveyDate: "2026-01-01", surveyor: "Sam", surveyType: "utility_mapping_survey", siteAddress: "S" },
    ]);
    expect(counts.all).toBe(2);
    expect(counts.final).toBe(1);
    expect(counts.draft).toBe(1);
  });
});
