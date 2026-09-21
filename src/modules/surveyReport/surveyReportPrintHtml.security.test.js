import { describe, expect, it, beforeEach } from "vitest";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml.js";
import { blankSurveyReport } from "./surveyReportConstants.js";

describe("surveyReportPrintHtml security", () => {
  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
  });

  it("renders Polish survey headings for a Poland workspace", () => {
    localStorage.setItem("mysafeops_orgId", "survey-pl");
    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_survey-pl",
      JSON.stringify({ id: "ws-pl", market_id: "pl", default_document_locale: "pl-PL", is_primary: false }),
    );
    const report = blankSurveyReport({
      title: "Badanie instalacji podziemnych",
      ref: "PL-SUR-001",
      client: "Klient",
      sections: { scope: "Zakres badania", methodology: "Metodyka terenowa" },
    });
    const html = buildSurveyReportHtml(report, {});
    expect(html).toContain('lang="pl-PL"');
    expect(html).toContain("Nadzór nad dokumentem");
    expect(html).toContain("Zakres prac");
    expect(html).toContain("Spis treści");
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
