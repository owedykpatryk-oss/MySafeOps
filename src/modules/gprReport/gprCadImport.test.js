import { describe, expect, it } from "vitest";
import { analyzeSurveyDxf } from "../../utils/surveyDxfAnalyzer.js";
import { blankGprReport } from "./gprReportConstants.js";
import {
  buildGprCadVerificationReport,
  isGprNamedLayer,
  isUmgLayer,
  isUmgUpgradedToB1,
  mergeGprCadAnalysisIntoReport,
  summariseGprAnomalies,
} from "./gprCadImport.js";

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
GPR_SCAN_L1
10
0
20
0
30
0
11
25
21
0
31
0
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
40
21
0
31
0
0
LINE
8
UMG_GAS_B2
10
0
20
0
30
0
11
15
21
0
31
0
0
LINE
8
TITLE_BLOCK
67
1
10
0
20
0
30
0
11
200
21
0
31
0
0
LINE
8
LAYOUT_BORDER
67
1
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
ENDSEC
0
EOF`;

describe("gprCadImport helpers", () => {
  it("detects GPR-named and UMG→B1 layers", () => {
    expect(isGprNamedLayer("GPR_SCAN_L1")).toBe(true);
    expect(isGprNamedLayer("UMG_LV_B1")).toBe(false);
    expect(isUmgLayer("UMG_LV_B1")).toBe(true);
    expect(isUmgUpgradedToB1("UMG_LV_B1")).toBe(true);
    expect(isUmgUpgradedToB1("UMG_GAS_B2")).toBe(false);
  });

  it("summarises anomalies by type", () => {
    const s = summariseGprAnomalies([
      { anomalyType: "utility", depthM: "0.8", confidence: "high" },
      { anomalyType: "utility", depthM: "", confidence: "medium" },
      { anomalyType: "void", depthM: "1.2", confidence: "low" },
    ]);
    expect(s.count).toBe(3);
    expect(s.withDepth).toBe(2);
    expect(s.highConfidence).toBe(1);
    expect(s.byType.find((t) => t.key === "utility")?.count).toBe(2);
  });
});

describe("gprCadImport DXF analysis", () => {
  it("ignores paper-space layout entities and counts GPR + UMG B1", () => {
    const analysis = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "gpr-site.dxf" });
    expect(analysis.modelSpaceOnly).toBe(true);
    expect(analysis.entityFilter.paperspaceSkipped).toBe(2);
    // TITLE_BLOCK 200m + LAYOUT_BORDER 50m must not be included
    expect(analysis.totals.lengthM).toBe(80); // 25+40+15

    const report = buildGprCadVerificationReport(analysis, {
      anomalies: [
        { anomalyType: "utility", depthM: "0.6", confidence: "high" },
        { anomalyType: "void", depthM: "1.1", confidence: "medium" },
      ],
    });

    expect(report.gprLayers.segmentCount).toBe(1);
    expect(report.gprLayers.lengthM).toBe(25);
    expect(report.umgB1Upgrades.segmentCount).toBe(1);
    expect(report.umgB1Upgrades.lengthM).toBe(40);
    expect(report.umgB1Upgrades.byUtility[0].utilityKey).toBe("lv_cable");
    expect(report.umgAll.segmentCount).toBe(2);
    expect(report.anomalies.count).toBe(2);
    expect(report.narrative).toMatch(/GPR CAD verification/);
    expect(report.narrative).toMatch(/UMG_\* upgraded to QL-B1/);
  });

  it("merges into GPR report findings", () => {
    const analysis = analyzeSurveyDxf(SAMPLE_DXF, { fileName: "site.dxf" });
    const base = blankGprReport({
      anomalies: [{ id: "a1", anomalyType: "utility", depthM: "0.9", confidence: "high", interpretation: "LV" }],
    });
    const next = mergeGprCadAnalysisIntoReport(base, analysis);
    expect(next.gprCadImport.fileName).toBe("site.dxf");
    expect(next.sections.findings).toContain("GPR CAD verification");
    expect(next.gprCadImport.anomalies.count).toBe(1);
  });
});
