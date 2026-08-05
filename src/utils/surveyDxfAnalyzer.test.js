import { describe, expect, it } from "vitest";
import {
  analyzeSurveyDxf,
  buildCadImportNarrative,
  compareCadImports,
  formatSummaryLine,
  isLikelyDwgBuffer,
  mergeCadAnalysisIntoReport,
  parseLayerSemantics,
  rebuildCadFromLayerBreakdown,
  seedUtilitiesTableFromCad,
} from "./surveyDxfAnalyzer.js";
import { blankSurveyReport } from "../modules/surveyReport/surveyReportConstants.js";

const SAMPLE_DXF = `0
SECTION
2
HEADER
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
UMG_LV_B1
10
0
20
0
30
0
11
34
21
0
31
0
0
LINE
8
PAS128-HV-B2
10
0
20
0
30
0
11
2
21
0
31
0
0
LWPOLYLINE
8
UMG_GAS_TFR
90
2
70
0
10
0
20
0
10
15
20
0
0
LINE
8
SITE_BOUNDARY
10
0
20
0
30
0
11
50
21
0
31
0
0
INSERT
8
BLOCK_UTIL
2
SYMBOL
10
0
20
0
30
0
0
TEXT
8
ANNO
10
0
20
0
30
0
40
2.5
1
Label
0
ENDSEC
0
EOF`;

describe("surveyDxfAnalyzer", () => {
  it("parses layer semantics UMG_LV_B1", () => {
    const s = parseLayerSemantics("UMG_LV_B1");
    expect(s.utilityKey).toBe("lv_cable");
    expect(s.qlKey).toBe("B1");
    expect(s.matched).toBe(true);
  });

  it("maps TFR to records-derived B4 equivalent", () => {
    const s = parseLayerSemantics("UMG_GAS_TFR");
    expect(s.qlKey).toBe("TFR");
    expect(s.pas128Equivalent).toBe("B4");
    expect(s.isRecordsDerived).toBe(true);
  });

  it("sums line lengths by utility and QL", () => {
    const a = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "test.dxf" });
    expect(a.totals.segments).toBeGreaterThanOrEqual(3);
    const lvB1 = a.summary.find((g) => g.utilityKey === "lv_cable" && g.qlKey === "B1");
    expect(lvB1).toBeTruthy();
    expect(lvB1.lengthM).toBe(34);
    const gasTfr = a.summary.find((g) => g.qlKey === "TFR");
    expect(gasTfr?.lengthM).toBe(15);
    expect(a.unmatchedLayers.some((l) => l.layer === "SITE_BOUNDARY")).toBe(true);
  });

  it("builds readable narrative with records note", () => {
    const a = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "site.dxf" });
    const text = buildCadImportNarrative(a, { whatWasNotFound: "Southern water records pending." });
    expect(text).toContain("CAD utility length summary");
    expect(text).toContain("LV");
    expect(text).toContain("TFR");
    expect(text).toContain("Southern water records pending");
    expect(formatSummaryLine(a.summary[0])).toMatch(/m .* \(/);
  });

  it("merges into survey report findings and utilities table", () => {
    const a = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "site.dxf" });
    const report = blankSurveyReport();
    const next = mergeCadAnalysisIntoReport(report, a);
    expect(next.cadImport.fileName).toBe("site.dxf");
    expect(next.sections.findings).toContain("CAD utility length summary");
    expect(next.utilitiesTable.length).toBeGreaterThan(0);
  });

  it("ignores INSERT and TEXT entities", () => {
    const a = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "test.dxf" });
    expect(a.entityFilter.skippedEntities.INSERT).toBe(1);
    expect(a.entityFilter.skippedEntities.TEXT).toBe(1);
    expect(a.totals.segments).toBe(4);
  });

  it("detects DWG magic bytes", () => {
    const buf = new TextEncoder().encode("AC1015");
    expect(isLikelyDwgBuffer(buf.buffer)).toBe(true);
  });

  it("builds plan preview paths", () => {
    const a = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "test.dxf" });
    expect(a.preview?.paths?.length).toBeGreaterThan(0);
    expect(a.preview.bounds).toBeTruthy();
  });

  it("rebuilds summary after manual layer mapping", () => {
    const a = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "test.dxf" });
    const rebuilt = rebuildCadFromLayerBreakdown(a.layerBreakdown, {
      SITE_BOUNDARY: { utilityKey: "water", qlKey: "B2" },
    });
    expect(rebuilt.unmatchedLayers.some((l) => l.layer === "SITE_BOUNDARY")).toBe(false);
    expect(rebuilt.summary.some((g) => g.utilityKey === "water")).toBe(true);
  });

  it("compares CAD re-imports", () => {
    const before = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "v1.dxf" });
    const after = analyzeSurveyDxf(SAMPLE_DXF.replace("34", "40"), { fileName: "v2.dxf" });
    const diff = compareCadImports(before, after);
    expect(diff.totalDeltaM).toBe(6);
    expect(diff.changes.length).toBeGreaterThan(0);
  });

  it("re-seeds utilities table from existing cadImport", () => {
    const a = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "site.dxf" });
    const withCad = mergeCadAnalysisIntoReport(blankSurveyReport(), a);
    const cleared = { ...withCad, utilitiesTable: [] };
    const seeded = seedUtilitiesTableFromCad(cleared, { replaceCadRows: true });
    expect(seeded?.utilitiesTable?.length).toBeGreaterThan(0);
    expect(seeded.utilitiesTable[0].notes).toMatch(/CAD layer/);
  });

  it("skips paper-space / layout entities by default (model space only)", () => {
    const withLayout = `0
SECTION
2
HEADER
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
UMG_LV_B1
10
0
20
0
30
0
11
10
21
0
31
0
0
LINE
8
SHEET_BORDER
67
1
10
0
20
0
30
0
11
999
21
0
31
0
0
ENDSEC
0
EOF`;
    const a = analyzeSurveyDxf(withLayout, { fileName: "model.dxf" });
    expect(a.entityFilter.paperspaceSkipped).toBe(1);
    expect(a.totals.lengthM).toBe(10);
    expect(a.layerBreakdown.some((l) => l.layer === "SHEET_BORDER")).toBe(false);
  });
});
