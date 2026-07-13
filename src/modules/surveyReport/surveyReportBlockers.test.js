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
