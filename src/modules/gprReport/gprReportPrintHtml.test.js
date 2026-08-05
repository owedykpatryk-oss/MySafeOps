/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { buildGprReportHtml } from "./gprReportPrintHtml.js";
import { blankGprReport } from "./gprReportConstants.js";
import { saveOrgSettingsRaw } from "../../utils/orgSettingsStorage.js";

describe("gprReportPrintHtml", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("builds a full HTML document without throwing (regression: radargramsBlock was undefined)", () => {
    const report = blankGprReport({ title: "Test GPR report", ref: "GPR-TEST-1" });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Radargrams &amp; scan images");
  });

  it("renders attached radargram images with escaped captions", () => {
    const report = blankGprReport({
      title: "Test GPR report",
      radargrams: [{ id: "rg1", dataUrl: "data:image/png;base64,abcd1234+/=", label: "Line 1", lineRef: "L1" }],
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("data:image/png;base64,abcd1234+/=");
    expect(html).toContain("Line 1");
  });

  it("falls back to a placeholder when no radargrams are attached", () => {
    const report = blankGprReport({ title: "Test GPR report" });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("No radargram images attached.");
  });

  it("renders a draft watermark and colour-coded confidence pills for anomalies", () => {
    const report = blankGprReport({
      title: "Test GPR report",
      status: "draft",
      anomalies: [
        { ref: "A1", anomalyType: "utility", depthM: 0.6, confidence: "high", interpretation: "Live gas main" },
        { ref: "A2", anomalyType: "void", depthM: 1.2, confidence: "low", interpretation: "Possible void" },
      ],
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("gpr-watermark");
    expect(html).toContain("DRAFT");
    expect(html).toContain("gpr-confidence-pill");
    expect(html).toContain("gpr-bar-chart");
    expect(html).toContain("gpr-print-footer");
  });

  it("uses the org's actual branding colours (primaryColor/accentColor), not the British-spelling fallback", () => {
    saveOrgSettingsRaw({ primaryColor: "#123456", accentColor: "#abcdef" });
    const report = blankGprReport({ title: "Branded report" });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("#123456");
    expect(html).toContain("#abcdef");
  });

  it("embeds acquisition diagram and chainage profile SVG in print HTML", () => {
    const report = blankGprReport({
      title: "Visual GPR",
      acquisition: { scanMode: "grid", lineSpacingM: "0.5", coveragePercent: "100" },
      chainageSegments: [
        { id: "c1", lineRef: "L1", chainageStartM: "0", chainageEndM: "10", thicknessOrDepthM: "0.8", conditionBand: "good" },
        { id: "c2", lineRef: "L1", chainageStartM: "10", chainageEndM: "20", thicknessOrDepthM: "1.2", conditionBand: "fair" },
      ],
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("gpr-acq-diagram");
    expect(html).toContain("Grid scan");
    expect(html).toContain("gpr-chainage-chart");
    expect(html).toContain("Chainage depth profile");
  });

  it("renders CAD model-space verification section when gprCadImport is present", () => {
    const report = blankGprReport({
      title: "CAD GPR",
      gprCadImport: {
        fileName: "site.dxf",
        units: "metres",
        paperspaceSkipped: 3,
        gprLayers: {
          segmentCount: 4,
          lengthM: 120,
          byLayer: [{ layer: "GPR_SCAN", lengthM: 120, segments: 4 }],
        },
        umgB1Upgrades: {
          segmentCount: 2,
          lengthM: 40,
          byUtility: [{ utilityKey: "lv_cable", utilityLabel: "LV cable", lengthM: 40, segments: 2 }],
        },
        umgAll: { segmentCount: 5, lengthM: 90, byQl: [{ qlKey: "B1", lengthM: 40, segments: 2 }] },
        anomalies: { count: 3, byType: [{ key: "utility", label: "Utility", count: 3 }] },
      },
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("CAD model-space verification");
    expect(html).toContain("Model space only");
    expect(html).toContain("GPR_SCAN");
    expect(html).toContain("UMG upgraded to QL-B1");
  });

  it("includes PAS128 line length summary when chainage uses UMG-style refs", () => {
    const report = blankGprReport({
      chainageSegments: [{ lineRef: "UMG_LV_B1", chainageStartM: 0, chainageEndM: 246 }],
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("PAS128 line lengths");
    expect(html).toContain("246 m");
    expect(html).toContain("LV cable");
  });

  it("includes a table of contents after the cover page", () => {
    const report = blankGprReport({ title: "TOC test", ref: "GPR-TOC-1" });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain('class="gpr-toc"');
    expect(html).toContain("Contents");
    expect(html).toContain('href="#find"');
    expect(html).toContain("gpr-running-header");
  });

  it("includes org compliance line in print footer when set", () => {
    saveOrgSettingsRaw({ pdfComplianceLine: "Geophysical indication only — verify by trial hole." });
    const report = blankGprReport({ title: "Test GPR report", ref: "GPR-TEST-1" });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("Geophysical indication only");
  });
});
