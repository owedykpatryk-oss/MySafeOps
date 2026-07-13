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
