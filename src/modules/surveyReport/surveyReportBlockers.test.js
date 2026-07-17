import { describe, expect, it, beforeEach } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import { buildSurveyBlockers } from "./surveyReportBlockers";
import { applyLinkedPermitToReport } from "./surveyReportSmart";

describe("surveyReportBlockers", () => {
  beforeEach(() => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  });

  it("lists quality missing items with tab targets", () => {
    const report = blankSurveyReport();
    const { blockers } = buildSurveyBlockers(report);
    expect(blockers.some((b) => b.tab === "details")).toBe(true);
    expect(blockers.some((b) => b.anchor)).toBe(true);
  });

  it("routes photo final-gate items to photos tab", () => {
    const report = blankSurveyReport({
      title: "T",
      surveyor: "A",
      surveyType: "utility_mapping_survey",
      sections: {
        scope: "s",
        methodology: "m",
        findings: "f",
        executiveSummary: "e",
        recommendations: "r",
      },
      qaChecklist: { catScanBeforeWork: true },
      standardsCited: ["pas128"],
      equipmentCalibration: [{ id: "1", instrument: "x" }],
      photos: [],
    });
    const { blockers } = buildSurveyBlockers(report);
    const photo = blockers.find((b) => /photo/i.test(b.label));
    expect(photo?.tab).toBe("photos");
    expect(photo?.anchor).toBe("photos");
  });

  it("flags low QA progress", () => {
    const report = blankSurveyReport({ surveyType: "utility_mapping_survey" });
    const { blockers } = buildSurveyBlockers(report);
    expect(blockers.some((b) => b.id === "qa_low")).toBe(true);
  });
});

describe("applyLinkedPermitToReport", () => {
  it("links permit and imports DBYD ref into enquiry log", () => {
    const report = blankSurveyReport({ surveyDate: "2026-07-12" });
    const next = applyLinkedPermitToReport(report, {
      id: "p1",
      permitNo: "PTW-001",
      extraFields: { dbydRef: "DBYD-99" },
    });
    expect(next.hseRefs.linkedPermitId).toBe("p1");
    expect(next.hseRefs.permitRef).toBe("PTW-001");
    expect(next.dbydEnquiries.some((r) => r.reference === "DBYD-99")).toBe(true);
  });
});
