/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import {
  blankEvidenceRow,
  blankRecordItem,
  blankGprAnomalyCard,
  blankSurveyArea,
  buildRecordsMatrixNarrative,
  buildEvidenceRowHtml,
  buildEvidenceRowsHtml,
  buildMethodLadderHtml,
  buildGprAnomalyCardsHtml,
  buildSurveyAreasFlipbookHtml,
  buildA3BoardPackHtml,
  defaultEquipmentKitForMethod,
  seedPremiumFieldsFromMethod,
  seedSurveyAreasFromExtent,
  blankExtentArea,
  buildQaChecklistProse,
  buildConstraintChipsHtml,
  buildUndertakerFindingsBlocksHtml,
} from "./surveyEvidencePack";
import { applyPas128MethodToReport, getPas128MethodPreset } from "./pas128MethodPresets";
import { blankSurveyReport, PAS128_METHODS } from "./surveyReportConstants";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml";

describe("PAS128 M3/M4 presets", () => {
  it("exposes M3 and M4 in method list and presets", () => {
    expect(PAS128_METHODS.map((m) => m.key)).toEqual(
      expect.arrayContaining(["M3", "M4", "M3P", "M4P"])
    );
    expect(getPas128MethodPreset("M3")?.gprGrid).toMatch(/1 m/);
    expect(getPas128MethodPreset("M4")?.workflowSteps?.[0]).toMatch(/MH\/IC/);
  });

  it("applies M3 methodology into a blank report", () => {
    const next = applyPas128MethodToReport(blankSurveyReport(), "M3", { overwrite: true });
    expect(next.pas128Method).toBe("M3");
    expect(next.sections.methodology).toMatch(/method M3/i);
  });
});

describe("survey evidence pack", () => {
  it("builds records narrative from status ticks", () => {
    const items = [
      blankRecordItem({ undertaker: "SGN", serviceType: "gas", status: "tfr", notes: "180mm PE" }),
      blankRecordItem({ undertaker: "BT", serviceType: "telecoms", status: "located" }),
    ];
    const text = buildRecordsMatrixNarrative(items);
    expect(text).toMatch(/Located on site/i);
    expect(text).toMatch(/TFR/i);
    expect(text).toMatch(/SGN/);
  });

  it("renders evidence row HTML safely", () => {
    const html = buildEvidenceRowHtml(
      blankEvidenceRow({
        title: '<script>alert(1)</script>',
        body: "Gas main TFR",
        tfr: true,
        cadImageUrl: "/branding/utility-mapping-logo.png",
      })
    );
    expect(html).toContain("sr-evidence-row");
    expect(html).not.toContain("<script>");
    expect(html).toContain("TFR");
  });

  it("seeds equipment kit from method", () => {
    const kit = defaultEquipmentKitForMethod("M2");
    expect(kit.length).toBeGreaterThanOrEqual(3);
    const seeded = seedPremiumFieldsFromMethod(blankSurveyReport(), "M2P");
    expect(seeded.equipmentKit.length).toBeGreaterThan(0);
  });

  it("method ladder highlights active step", () => {
    const html = buildMethodLadderHtml("M4P");
    expect(html).toContain("sr-method-step--on");
    expect(html).toContain("M4P");
  });

  it("print HTML includes evidence and records scoreboard", () => {
    const report = blankSurveyReport({
      title: "Test",
      surveyType: "utility_mapping_survey",
      sections: { findings: "Summary findings.", scope: "Scope", methodology: "Method" },
      accessLimitations: ["locked_gate", "live_plant"],
      recordItems: [blankRecordItem({ undertaker: "Cadent", serviceType: "gas", status: "tfr" })],
      evidenceRows: [
        blankEvidenceRow({
          title: "Gas TFR",
          body: "Not located — added from records.",
          tfr: true,
          undertaker: "Cadent",
          photoUrls: ["/branding/utility-mapping-logo.png"],
        }),
      ],
      extentAreas: [
        {
          id: "a1",
          label: "AOC1",
          chainage: "CH 100m",
          planImageUrl: "",
          photoUrls: ["/branding/utility-mapping-logo.png"],
          notes: "",
        },
      ],
      equipmentKit: defaultEquipmentKitForMethod("M2"),
      customSections: [{ id: "c1", title: "Client note", body: "Please review TFR.", afterSectionId: "findings" }],
    });
    const html = buildSurveyReportHtml(report);
    expect(html).toContain("sr-evidence-row");
    expect(html).toContain("sr-records-scoreboard");
    expect(html).toContain("sr-kit-card");
    expect(html).toContain("Client note");
    expect(html).toContain("sr-extent-plate");
    expect(html).toContain("sr-constraint-chips");
    expect(html).toContain("sr-tfr-legend");
    expect(html).toContain("sr-undertaker-findings");
    expect(html).toContain("sr-cover-insight");
    expect(buildEvidenceRowsHtml(report.evidenceRows)).toContain("Gas TFR");
    expect(buildConstraintChipsHtml(report)).toMatch(/Locked gate/i);
    expect(buildUndertakerFindingsBlocksHtml(report.recordItems, report.evidenceRows)).toMatch(/Cadent/);
  });

  it("builds QA prose from checklist ticks", () => {
    const prose = buildQaChecklistProse({ catScanBeforeWork: true }, "utility_mapping_survey");
    expect(prose.length).toBeGreaterThan(10);
    expect(prose).toMatch(/QA checks completed/i);
  });

  it("seeds survey areas from extent AOC", () => {
    const seeded = seedSurveyAreasFromExtent({
      extentAreas: [blankExtentArea({ label: "AOC1", chainage: "CH 100" })],
      surveyAreas: [],
    });
    expect(seeded.surveyAreas).toHaveLength(1);
    expect(seeded.surveyAreas[0].label).toBe("AOC1");
  });

  it("renders GPR anomaly cards, depth histogram and multi-area flipbook", () => {
    const gpr = buildGprAnomalyCardsHtml(
      [
        blankGprAnomalyCard({
          ref: "A-01",
          classKey: "linear",
          depthMinM: "0.4",
          depthMaxM: "0.5",
          interpretation: "Shallow duct",
        }),
        blankGprAnomalyCard({
          ref: "A-02",
          classKey: "unknown",
          depthMinM: "1.1",
          depthMaxM: "1.3",
          interpretation: "Deeper response",
        }),
        blankGprAnomalyCard({
          ref: "A-03",
          classKey: "linear",
          depthMinM: "0.9",
          depthMaxM: "1.0",
          interpretation: "Mid depth",
        }),
      ],
      "Two linear responses warrant trial holes."
    );
    expect(gpr).toContain("sr-gpr-card");
    expect(gpr).toContain("A-01");
    expect(gpr).toContain("sr-gpr-hist");
    expect(gpr).toMatch(/conclusions/i);

    const areas = buildSurveyAreasFlipbookHtml([
      blankSurveyArea({ label: "Corridor A", chainage: "CH 0–200", findingsNote: "Gas TFR east verge." }),
    ]);
    expect(areas).toContain("sr-area-page");
    expect(areas).toContain("Corridor A");
  });

  it("builds A3 board pack with records status (not dig-first)", () => {
    const html = buildA3BoardPackHtml(
      {
        title: "Board test",
        ref: "UM-26-TEST",
        client: "Acme",
        pas128Method: "M2P",
        pas128Ql: "B",
        documentControl: { revision: "B" },
        recordItems: [blankRecordItem({ undertaker: "SGN", status: "tfr", notes: "180mm" })],
        sections: { executiveSummary: "Proceed with caution on gas TFR." },
      },
      { orgName: "Utility Mapping" }
    );
    expect(html).toContain("A3");
    expect(html).toContain("Records status");
    expect(html).toContain("SGN");
    expect(html).not.toMatch(/Dig readiness/i);
  });

  it("print HTML includes GPR cards and survey areas", () => {
    const report = blankSurveyReport({
      title: "GPR test",
      surveyType: "utility_mapping_survey",
      sections: { findings: "Findings.", scope: "Scope", methodology: "Method", surveyExtent: "Extent" },
      gprConclusions: "Review A-01 before dig.",
      gprAnomalyCards: [
        blankGprAnomalyCard({ ref: "A-01", classKey: "linear", interpretation: "Utility-like" }),
      ],
      surveyAreas: [blankSurveyArea({ label: "AOC North", findingsNote: "Located HV." })],
    });
    const html = buildSurveyReportHtml(report);
    expect(html).toContain("sr-gpr-card");
    expect(html).toContain("sr-area-flipbook");
    expect(html).toContain("AOC North");
  });
});
