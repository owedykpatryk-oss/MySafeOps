import { describe, expect, it } from "vitest";
import { analyzeSurveyDxf } from "./surveyDxfAnalyzer.js";
import { buildCadPreviewSvg, buildCadQlDonutSvg } from "./cadPreviewSvg.js";
import { buildCadVisualSummary } from "./cadImportVisuals.js";

const SAMPLE = `0
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
20
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
10
20
0
0
ENDSEC
0
EOF`;

describe("cadPreviewSvg", () => {
  it("renders SVG preview and QL donut", () => {
    const a = analyzeSurveyDxf(SAMPLE, { fileName: "site.dxf" });
    const svg = buildCadPreviewSvg(a.preview);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");

    const visual = buildCadVisualSummary(a);
    const donut = buildCadQlDonutSvg(visual.byQl, visual.totalM);
    expect(donut).toContain("sr-cad-donut-wrap");
  });
});
