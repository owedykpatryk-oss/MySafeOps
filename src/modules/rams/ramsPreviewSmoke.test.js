import { describe, it, expect } from "vitest";
import { getRiskLevel } from "./ramsRiskLevel.js";
import { buildRamsPreviewHtml } from "./ramsPrintHtml.js";
import SITE_CONTEXT_LIBRARY from "./ramsHazardLibrarySiteContext.js";
import { buildSurveyReportHtml } from "../surveyReport/surveyReportPrintHtml.js";
import { sanitizePrintPreviewHtml } from "../../utils/htmlEscape.js";
import { siteContextBadgeLabel } from "./ramsPlaybookEnrichment.js";

describe("RAMS / survey preview smoke", () => {
  it("getRiskLevel tolerates missing risk objects", () => {
    expect(getRiskLevel(undefined)).toBe("low");
    expect(getRiskLevel(null)).toBe("low");
    expect(getRiskLevel({})).toBe("low");
    expect(getRiskLevel({ RF: 12 })).toBe("medium");
    expect(getRiskLevel({ RF: 24 })).toBe("high");
  });

  it("builds RAMS A4 preview with site-context rows and strips javascript URLs", () => {
    const row = SITE_CONTEXT_LIBRARY[0];
    const form = {
      title: "UM Topo RAMS",
      documentNo: "RAMS-001",
      projectId: "p1",
      clientName: "Test Client",
      siteAddress: "1 High St, Guildford",
      surveyWorkType: "topo",
      surveyWorkTypeLabel: "Topographic survey",
      siteContextKey: "treatment_works",
      siteMapUrl: "javascript:alert(1)",
      hospitalDirectionsUrl: "https://maps.google.com/?q=hospital",
      methodStatement: "Total station + GNSS",
      operativeIds: ["w1"],
      printSections: {},
    };
    const html = buildRamsPreviewHtml(
      form,
      [
        {
          id: "r1",
          activity: row.activity,
          hazard: row.hazard,
          controlMeasures: row.controlMeasures,
          initialRisk: row.initialRisk,
          revisedRisk: row.revisedRisk,
          ppeRequired: row.ppeRequired,
          regs: row.regs,
        },
      ],
      [{ id: "w1", name: "Alex" }],
      [{ id: "p1", name: "Guildford WWTW" }]
    );
    expect(html.length).toBeGreaterThan(1000);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toMatch(/maps\.google\.com/);
    expect(siteContextBadgeLabel(form)).toMatch(/Treatment/i);
    expect(html).toMatch(/Site:/);
    expect(html).toMatch(/Topographic survey|topo/i);
  });

  it("builds Survey report preview HTML", () => {
    const html = sanitizePrintPreviewHtml(
      buildSurveyReportHtml(
        {
          title: "PAS128 Survey",
          documentNo: "SUR-001",
          clientName: "Test Client",
          siteAddress: "1 High St",
          surveyType: "pas128",
          methodology: "EML + GPR",
          findingsSummary: "Utilities located",
          limitationsText: "Access limited",
          photos: [],
        },
        { projectLat: 51.23, projectLng: -0.57 }
      )
    );
    expect(html.length).toBeGreaterThan(500);
    expect(html).toMatch(/PAS128|SUR-001/i);
  });

  it("RAMS preview survives empty / partial rows without throwing", () => {
    expect(() => buildRamsPreviewHtml({}, [{ id: "x" }], [], [])).not.toThrow();
    const html = buildRamsPreviewHtml(null, null, null, null);
    expect(html).toMatch(/html/i);
  });
});
