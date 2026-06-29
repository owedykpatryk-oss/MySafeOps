import { describe, expect, it, beforeEach } from "vitest";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml.js";
import { blankSurveyReport } from "./surveyReportConstants.js";

describe("surveyReportPrintHtml security", () => {
  beforeEach(() => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  });

  it("strips javascript: photo sources from exported HTML", () => {
    const report = blankSurveyReport({
      title: "Test",
      photos: [{ id: "p1", dataUrl: "javascript:alert(1)", caption: "Evil" }],
    });
    const html = buildSurveyReportHtml(report, {});
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toContain('src="javascript:');
  });

  it("allows safe raster data URLs in photos", () => {
    const report = blankSurveyReport({
      title: "Test",
      photos: [{ id: "p1", dataUrl: "data:image/png;base64,abcd1234+/=", caption: "OK" }],
    });
    const html = buildSurveyReportHtml(report, {});
    expect(html).toContain("data:image/png;base64,abcd1234+/=");
  });

  it("blocks unsafe site plan snapshot sources from exported HTML", () => {
    const report = blankSurveyReport({
      title: "Test",
      sitePlanSnapshots: [
        {
          planId: "pl_1",
          name: "Plan",
          dataUrl: '"><script>alert(1)</script><img src="',
        },
      ],
    });
    const html = buildSurveyReportHtml(report, {});
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('"><script>');
  });
});
