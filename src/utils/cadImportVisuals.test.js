import { describe, expect, it } from "vitest";
import { analyzeSurveyDxf } from "./surveyDxfAnalyzer.js";
import { buildCadFieldComparison, buildCadVisualSummary, cadQlStyle } from "./cadImportVisuals.js";

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
11
34
21
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
ENDSEC
0
EOF`;

describe("cadImportVisuals", () => {
  it("builds stat cards and bar chart data", () => {
    const analysis = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "site.dxf" });
    const cad = { ...analysis, narrative: "" };
    const v = buildCadVisualSummary(cad);
    expect(v.statCards[0].value).toMatch(/49 m|50 m/);
    expect(v.byUtility.length).toBeGreaterThanOrEqual(2);
    expect(v.byUtility[0].barPct).toBeGreaterThan(0);
    expect(v.composition.some((c) => c.key === "records")).toBe(true);
  });

  it("compares CAD with field schedule", () => {
    const analysis = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "site.dxf" });
    const rows = buildCadFieldComparison(analysis, [{ utilityType: "lv_cable" }, { utilityType: "gas" }]);
    expect(rows.find((r) => r.utilityKey === "lv_cable")?.hasFieldMatch).toBe(true);
    expect(rows.find((r) => r.utilityKey === "gas")?.hasFieldMatch).toBe(true);
  });

  it("returns QL styles", () => {
    expect(cadQlStyle("B1").color).toMatch(/^#/);
    expect(cadQlStyle("TFR").label).toBe("TFR");
  });
});
