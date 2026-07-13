import { describe, expect, it, beforeEach } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants.js";
import {
  applyPas128BoilerplateToReport,
  buildPas128Foreword,
  DEFAULT_SURVEY_REPORT_DISCLAIMER,
  defaultDeliverablesForPas128Method,
  getSurveyReportDisclaimer,
} from "./pas128ReportBoilerplate.js";
import { applyPas128MethodToReport } from "./pas128MethodPresets.js";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml.js";

describe("pas128ReportBoilerplate", () => {
  it("builds generic foreword without client or site names", () => {
    const text = buildPas128Foreword({
      pas128Method: "M2P",
      pas128Ql: "B1",
      client: "Acme Ltd",
      siteAddress: "1 Example Road",
    });
    expect(text).toMatch(/PAS 128:2022/i);
    expect(text).toMatch(/M2P/);
    expect(text).not.toMatch(/Acme/i);
    expect(text).not.toMatch(/Example Road/i);
  });

  it("M1 foreword references Survey Type D", () => {
    const text = buildPas128Foreword({ pas128Method: "M1", pas128Ql: "B4" });
    expect(text).toMatch(/Survey Type D/i);
    expect(text).toMatch(/HSG47/i);
  });

  it("uses org disclaimer override when set", () => {
    expect(getSurveyReportDisclaimer({})).toBe(DEFAULT_SURVEY_REPORT_DISCLAIMER);
    expect(getSurveyReportDisclaimer({ surveyReportDisclaimer: "Custom disclaimer." })).toBe("Custom disclaimer.");
  });

  it("applies default deliverables per method", () => {
    expect(defaultDeliverablesForPas128Method("M1").some((d) => d.description.includes("Undertaker"))).toBe(true);
    expect(defaultDeliverablesForPas128Method("M4P").some((d) => d.format === "dwg")).toBe(true);
  });

  it("applyPas128MethodToReport fills foreword and deliverables", () => {
    const next = applyPas128MethodToReport(blankSurveyReport(), "M1", { overwrite: true });
    expect(next.sections.foreword).toMatch(/Survey Type D/i);
    expect(next.deliverables.length).toBeGreaterThan(0);
  });
});

describe("undertaker response status in PDF", () => {
  beforeEach(() => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  });

  it("renders undertaker table and summary", () => {
    const report = applyPas128MethodToReport(
      blankSurveyReport({
        title: "Desktop utility search",
        surveyType: "utility_mapping_survey",
        sections: { foreword: buildPas128Foreword({ pas128Method: "M1" }), findings: "Summary of responses." },
        undertakerResponses: [
          { undertaker: "DNO", category: "electricity", status: "affected", responseDate: "2026-01-10", notes: "" },
          { undertaker: "Gas co", category: "gas", status: "not_affected", responseDate: "2026-01-11", notes: "" },
        ],
      }),
      "M1",
      { overwrite: true }
    );
    const html = buildSurveyReportHtml(report, {});
    expect(html).toContain("Undertaker response status");
    expect(html).toContain("Response summary");
    expect(html).toContain("Foreword");
    expect(html).toContain(DEFAULT_SURVEY_REPORT_DISCLAIMER.slice(0, 40));
  });
});
