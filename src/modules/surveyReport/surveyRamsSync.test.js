/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import {
  buildRamsHseExcerpt,
  buildRamsPatchFromSurveyReport,
  mergeRamsWithSurveyReport,
  syncSurveyReportFromRams,
} from "./surveyRamsSync";

describe("surveyRamsSync", () => {
  it("syncSurveyReportFromRams uses catalog methodology not raw RAMS prose", () => {
    const report = blankSurveyReport({ sections: { scope: "", methodology: "", equipmentUsed: "" } });
    const rams = {
      id: "rams_1",
      title: "Site RAMS",
      surveyWorkType: "utility_mapping_survey",
      surveyMethodStatement: "4.0 Work procedure\n4.5 Safe work procedure\nFull RAMS text",
      surveyDeliverables: "Old deliverables line",
      surveyHoldPoints: ["HP1 records review complete"],
    };
    const next = syncSurveyReportFromRams(report, rams, { overwrite: true });
    expect(next.surveyType).toBe("utility_mapping_survey");
    expect(next.sections.methodology).toMatch(/PAS 128 Type B/i);
    expect(next.sections.methodology).not.toMatch(/4\.0 Work procedure/);
    expect(next.sections.scope).toMatch(/PAS 128 utility mapping/i);
    expect(next.pas128Method).toBe("M2");
    expect(next.hseRefs.ramsExcerpt).toMatch(/Site RAMS/);
    expect(next.hseRefs.ramsExcerpt).toMatch(/HP1/);
    expect(next.standardsCited).toContain("pas128");
  });

  it("buildRamsPatchFromSurveyReport returns structured pack fields", () => {
    const report = blankSurveyReport({
      id: "sr_1",
      surveyType: "drainage_connectivity_survey",
      sections: { scope: "Custom scope text." },
    });
    const patch = buildRamsPatchFromSurveyReport(report);
    expect(patch?.surveyWorkType).toBe("drainage_connectivity_survey");
    expect(patch?.surveyMethodStatement).toMatch(/4\.0 Work procedure/i);
    expect(patch?.surveyHoldPoints?.length).toBeGreaterThan(0);
    expect(patch?.surveyDeliverables).toBe("Custom scope text.");
  });

  it("mergeRamsWithSurveyReport links survey id", () => {
    const rams = { id: "r1", title: "RAMS", rows: [] };
    const report = blankSurveyReport({ id: "s1", surveyType: "gpr_survey" });
    const next = mergeRamsWithSurveyReport(rams, report);
    expect(next.surveyWorkType).toBe("gpr_survey");
    expect(next.linkedSurveyIds).toEqual(["s1"]);
    expect(next.ramsSyncedFromSurveyAt).toBeTruthy();
  });

  it("buildRamsHseExcerpt combines title and hold points", () => {
    expect(
      buildRamsHseExcerpt({
        title: "RAMS-2026",
        surveyHoldPoints: ["HP1 check", "HP2 scan"],
      })
    ).toMatch(/RAMS-2026.*HP1 check/);
  });
});
