import { describe, expect, it } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import { enrichSurveyListRows, surveyListGroupMeta } from "./surveyReportListRows";

describe("surveyReportListRows", () => {
  it("enriches rows with quality and thumbs", () => {
    const rows = enrichSurveyListRows(
      [
        blankSurveyReport({
          id: "1",
          projectId: "p1",
          title: "A",
          surveyDate: "2026-01-01",
          surveyor: "Sam",
          surveyType: "utility_mapping_survey",
          siteAddress: "Site",
        }),
      ],
      [{ id: "p1", lat: 51.5, lng: -0.1 }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBeGreaterThan(0);
    expect(rows[0].mapThumb).toContain("staticmap");
  });

  it("builds group meta map", () => {
    const meta = surveyListGroupMeta([
      { projectId: "p1", label: "Alpha", reports: [{ id: "1" }, { id: "2" }] },
    ]);
    expect(meta.get("p1")?.count).toBe(2);
    expect(meta.get("p1")?.label).toBe("Alpha");
  });
});
