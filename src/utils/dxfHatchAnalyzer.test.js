import { describe, expect, it } from "vitest";
import {
  analyzeDxfHatches,
  classifyHatchLayer,
  formatAreaM2,
  polygonAreaM2,
  buildHatchConstraintNarrative,
} from "./dxfHatchAnalyzer.js";

const HATCH_DXF = `0
SECTION
2
ENTITIES
0
HATCH
8
VEGETATION
67
0
2
SOLID
70
1
71
0
91
1
92
1
93
4
10
0
20
0
10
10
20
0
10
10
20
5
10
0
20
5
97
0
0
HATCH
8
OBSTRUCTION
2
SOLID
91
1
92
1
93
4
10
0
20
0
10
4
20
0
10
4
20
4
10
0
20
4
97
0
0
HATCH
8
TITLE_HATCH
67
1
2
SOLID
91
1
92
1
93
4
10
0
20
0
10
100
20
0
10
100
20
100
10
0
20
100
97
0
0
ENDSEC
0
EOF`;

describe("dxfHatchAnalyzer", () => {
  it("classifies vegetation / obstruction / building layers", () => {
    expect(classifyHatchLayer("VEGETATION").key).toBe("vegetation");
    expect(classifyHatchLayer("FOLIAGE_AREA").key).toBe("vegetation");
    expect(classifyHatchLayer("SITE_OBSTRUCTION").key).toBe("obstruction");
    expect(classifyHatchLayer("BUILDING_FOOTPRINT").key).toBe("building");
    expect(classifyHatchLayer("NO_ACCESS_ZONE").key).toBe("no_access");
    expect(classifyHatchLayer("UMG_LV_B1")).toBeNull();
  });

  it("computes shoelace area", () => {
    // 10 x 5 rectangle = 50
    expect(polygonAreaM2([
      [0, 0],
      [10, 0],
      [10, 5],
      [0, 5],
    ])).toBe(50);
    expect(formatAreaM2(50)).toBe("50 m²");
  });

  it("parses model-space hatches and skips paper-space", () => {
    const report = analyzeDxfHatches(HATCH_DXF, { scale: 1, modelSpaceOnly: true });
    expect(report.paperspaceSkipped).toBe(1);
    expect(report.constraintHatchCount).toBe(2);
    expect(report.totalConstraintAreaM2).toBe(50 + 16); // 10x5 + 4x4
    const veg = report.byCategory.find((c) => c.key === "vegetation");
    expect(veg.hatchCount).toBe(1);
    expect(veg.areaM2).toBe(50);
    expect(veg.narrative).toMatch(/vegetation/i);
    expect(report.limitationKeys).toContain("access_coverage");
    expect(buildHatchConstraintNarrative(report)).toMatch(/Unable to survey|No access|vegetation/i);
  });
});
