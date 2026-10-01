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

  it("places up to three finding photos side by side under the anomaly text", () => {
    const html = buildGprReportHtml(blankGprReport({
      anomalies: [
        {
          ref: "A1",
          anomalyType: "utility",
          depthM: "0.6",
          confidence: "medium",
          interpretation: "Linear response on line 2",
          figures: [
            { role: "gpr", dataUrl: "data:image/png;base64,aaaa" },
            { role: "cad", dataUrl: "data:image/png;base64,bbbb" },
          ],
        },
        {
          ref: "A2",
          anomalyType: "void",
          depthM: "1.1",
          confidence: "low",
          interpretation: "Amplitude drop",
          figures: [
            { role: "gpr", dataUrl: "data:image/png;base64,cccc" },
            { role: "cad", dataUrl: "data:image/png;base64,dddd" },
            { role: "satellite", dataUrl: "data:image/jpeg;base64,eeee" },
          ],
        },
      ],
    }), {});
    expect(html).toContain("gpr-finding-photos--2");
    expect(html).toContain("gpr-finding-photos--3");
    expect(html).toContain("Linear response on line 2");
    expect(html).toContain(">GPR<");
    expect(html).toContain(">CAD<");
    expect(html).toContain("Archive / satellite");
    expect(html).toContain("height: 52mm");
    expect(html).not.toContain("data:image/png;base64,not-a-photo");
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

  it("renders the selected equipment product profile and technical facts", () => {
    const report = blankGprReport({
      title: "Stream DP report",
      equipment: [{
        presetKey: "ids_stream_dp",
        manufacturer: "IDS GeoRadar",
        model: "Stream DP",
        antennaFrequencyMhz: 600,
        channels: 30,
        processingSoftware: "uMap / IQMaps",
      }],
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("gpr-equipment-profile");
    expect(html).toContain("/assets/gpr/equipment/ids-stream-dp.jpg");
    expect(html).toContain("30 channels: 19 VV + 11 HH");
    expect(html).toContain("Official product information");
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

  it("uses a report-specific visual theme without changing organisation branding", () => {
    saveOrgSettingsRaw({ primaryColor: "#123456", accentColor: "#abcdef" });
    const report = blankGprReport({
      title: "Premium themed report",
      visualTheme: { presetKey: "ultraviolet" },
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("#4C1D95");
    expect(html).toContain("#8B5CF6");
    expect(html).not.toContain("border-bottom: 2px solid #abcdef");
  });

  it("renders a controlled FINAL issue even when the organisation draft watermark is configured", () => {
    saveOrgSettingsRaw({ pdfWatermarkText: "DRAFT" });
    const html = buildGprReportHtml(blankGprReport({
      status: "final",
      revision: "C02",
      issuePurpose: "Final issue",
      finalisedAt: "2026-09-24T10:30:00.000Z",
    }), {});
    expect(html).toContain("FINAL ISSUE");
    expect(html).toContain("C02");
    expect(html).toContain('<div class="gpr-watermark">FINAL</div>');
    expect(html).not.toContain('<div class="gpr-watermark">DRAFT</div>');
  });

  it("adds a detailed acquisition schedule and depth feasibility warning", () => {
    const html = buildGprReportHtml(blankGprReport({
      acquisition: { scanMode: "route", lineSpacingM: "0.25", traceSpacingM: "0.05", depthRangeM: "3", timeWindowNs: "65", coveragePercent: "92" },
      equipment: [{ manufacturer: "IDS", model: "Stream DP", antennaFrequencyMhz: 600, channels: 19 }],
      groundConditions: { expectedPenetrationM: 1.2, dielectricRange: [8, 20], siteObservations: {} },
    }), {});
    expect(html).toContain("Technical relevance");
    expect(html).toContain("Trace spacing");
    expect(html).toContain("exceeds the BGS-informed indicative penetration");
  });

  it("keeps a zero chainage start in the exported schedule", () => {
    const report = blankGprReport({
      chainageSegments: [{
        id: "seg-zero",
        lineRef: "UMG_LV_B1",
        chainageStartM: 0,
        chainageEndM: 10,
        thicknessOrDepthM: 0.7,
        conditionBand: "good",
        profileNotes: "Clear response",
      }],
    });
    expect(buildGprReportHtml(report)).toContain("0 – 10");
  });

  it("adds an automatic anomaly confidence and depth summary", () => {
    const report = blankGprReport({
      anomalies: [
        { ref: "A1", anomalyType: "utility", depthM: "0.45", interpretation: "Linear response", confidence: "high" },
        { ref: "A2", anomalyType: "void", depthM: "1.20", interpretation: "Loss of reflection", confidence: "low" },
      ],
    });
    const html = buildGprReportHtml(report);
    expect(html).toContain("Total responses");
    expect(html).toContain("High confidence");
    expect(html).toContain("0.45–1.20 m");
    expect(html).toContain("1 low-confidence response requires corroboration");
  });

  it("replaces duplicated section text during export", () => {
    const repeated = "This copied report paragraph is long enough to appear in several sections and should be replaced with contextual narrative.";
    const html = buildGprReportHtml(blankGprReport({
      siteAddress: "Glasgow Airport",
      sections: { foreword: repeated, executiveSummary: repeated, scope: repeated, methodology: repeated },
    }), {});
    expect(html.match(new RegExp(repeated, "g")) || []).toHaveLength(0);
    expect(html).toContain("Glasgow Airport");
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

  it("prints an acquisition screenshot whole and drops an unsafe image", () => {
    const html = buildGprReportHtml(blankGprReport({
      acquisition: {
        scanMode: "grid",
        screenshots: [
          { id: "s1", dataUrl: "data:image/png;base64,aaaa", caption: "IDS acquisition window" },
          { id: "s2", dataUrl: "javascript:alert(1)", caption: "bad" },
        ],
      },
    }), {});
    expect(html).toContain("gpr-acq-shot");
    expect(html).toContain("IDS acquisition window");
    expect(html).toContain("object-fit: contain");
    expect(html).not.toContain("javascript:alert");
  });

  it("prints an acquisition screenshot whole and drops an unsafe image", () => {
    const html = buildGprReportHtml(blankGprReport({
      acquisition: {
        scanMode: "grid",
        screenshots: [
          { id: "s1", dataUrl: "data:image/png;base64,aaaa", caption: "IDS acquisition window" },
          { id: "s2", dataUrl: "javascript:alert(1)", caption: "bad" },
        ],
      },
    }), {});
    expect(html).toContain("gpr-acq-shot");
    expect(html).toContain("IDS acquisition window");
    expect(html).toContain("object-fit: contain");
    expect(html).not.toContain("javascript:alert");
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

  it("renders pre-survey start checks with GPS, weather and objectives", () => {
    const report = blankGprReport({
      title: "Start GPR",
      preSurvey: {
        startedAt: "2026-09-18T08:05:00.000Z",
        startedBy: "Pat",
        lat: 51.5,
        lng: -0.12,
        gpsAccuracyM: 5,
        gpsSource: "device",
        weather: { description: "Overcast", tempC: 12, windMph: 8 },
        surveyDates: ["2026-09-18", "2026-09-19"],
        surfaceKeys: ["asphalt"],
        moisture: "damp",
        objectives: ["voids", "foundations"],
        siteChecks: { ramsBriefed: true },
        notes: "East wing pile caps",
        photos: [{ dataUrl: "data:image/jpeg;base64,sitepic", caption: "North elevation" }],
      },
    });
    const html = buildGprReportHtml(report, {});
    expect(html).toContain("Pre-survey start checks");
    expect(html).toContain("51.50000");
    expect(html).toContain("Overcast");
    expect(html).toContain("Voids");
    expect(html).toContain("Foundations");
    expect(html).toContain("East wing pile caps");
    expect(html).toContain("data:image/jpeg;base64,sitepic");
    expect(html).toContain('href="#presurvey"');
  });

  it("prints only verified historic facts and drops invented AI wording", () => {
    const html = buildGprReportHtml(blankGprReport({
      historicalEvidence: [
        {
          id: "map-1",
          verified: true,
          sourceUrl: "https://maps.nls.uk/view/example",
          sourceName: "NLS",
          sourceDate: "1898",
          title: "OS 1898",
          observedFact: "The 1898 sheet depicts a rectangular building footprint.",
        },
        {
          id: "fake",
          verified: false,
          sourceUrl: "https://archive.example/cemetery",
          observedFact: "A cemetery occupies the whole site.",
        },
      ],
      evidenceReview: {
        model: "gpt-6-luna",
        reviewedAt: "2026-09-25T10:00:00.000Z",
        assessments: [
          {
            evidenceId: "map-1",
            relevance: "This site is definitely a burial ground",
            mechanisms: ["grave_or_burial_features"],
            recommendedActions: ["none"],
            caveat: "none",
          },
        ],
      },
    }), {});
    expect(html).toContain("Historic evidence");
    expect(html).toContain("rectangular building footprint");
    expect(html).not.toContain("cemetery occupies");
    expect(html).not.toContain("definitely a burial ground");
    expect(html).toContain("Not classified by AI");
  });

  it("states that no former-land-use claim is included when nothing is verified", () => {
    const html = buildGprReportHtml(blankGprReport({
      historicalEvidence: [{ id: "x", verified: false, observedFact: "Old castle foundations everywhere." }],
    }), {});
    expect(html).toContain("No verified historic evidence");
    expect(html).not.toContain("Old castle foundations");
  });

  it("prints the client logo alone or beside the organisation logo", () => {
    saveOrgSettingsRaw({ name: "Utility Mapping", logo: "data:image/png;base64,b3Jn" });
    const clientLogo = "data:image/png;base64,Y2xpZW50";
    const clientOnly = buildGprReportHtml(blankGprReport({
      coverBranding: { mode: "client", clientName: "Barnes Fernandez", clientLogoDataUrl: clientLogo },
    }));
    expect(clientOnly).toContain(clientLogo);
    expect(clientOnly).toContain("Barnes Fernandez");
    expect(clientOnly).not.toContain("data:image/png;base64,b3Jn");

    const both = buildGprReportHtml(blankGprReport({
      coverBranding: { mode: "both", clientName: "Birmingham City Council", clientLogoDataUrl: clientLogo },
    }));
    expect(both).toContain(clientLogo);
    expect(both).toContain("data:image/png;base64,b3Jn");
  });

  it("prints the first site photograph on the cover", () => {
    const photo = "data:image/jpeg;base64,c2l0ZQ==";
    const html = buildGprReportHtml(blankGprReport({
      preSurvey: { photos: [{ dataUrl: photo, caption: "Yard" }] },
    }));
    expect(html).toContain(photo);
    expect(html).toContain("Site photograph");
  });
});
