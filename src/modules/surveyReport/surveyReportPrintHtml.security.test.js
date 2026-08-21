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

  it("keeps UK en-GB survey pack, PAS 128 headings, and English document control", () => {
    localStorage.setItem("mysafeops_orgId", "survey-uk");
    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_survey-uk",
      JSON.stringify({ id: "ws-uk", market_id: "uk", default_document_locale: "en-GB", is_primary: true }),
    );
    const report = blankSurveyReport({
      title: "PAS 128 utility mapping — Bristol",
      ref: "UK-SUR-001",
      client: "Main contractor",
      surveyType: "utility_mapping_survey",
      pas128Ql: "B1",
      finalisedAt: "2026-08-01T12:00:00.000Z",
      sections: { scope: "Locate buried utilities before excavation.", methodology: "EML and GPR per PAS 128." },
    });
    const html = buildSurveyReportHtml(report, {});
    expect(html).toContain('lang="en-GB"');
    expect(html).toContain("Document control");
    expect(html).toContain("Contents");
    expect(html).toContain("PAS 128 quality levels");
    expect(html).toContain("Finalised");
    expect(html).toContain("01/08/2026");
    expect(html).not.toMatch(/8\/1\/2026/);
    expect(html).not.toContain("Nadzór nad dokumentem");
    expect(html).not.toContain("Spis treści");
    expect(html).not.toContain("Kodeks pracy");
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
