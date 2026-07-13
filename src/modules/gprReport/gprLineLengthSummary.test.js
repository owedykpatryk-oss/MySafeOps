import { describe, expect, it } from "vitest";
import {
  buildGprLineLengthSummary,
  buildGprSurveyLineComparison,
  chainageSegmentLengthM,
  chainageSegmentsFromSurveyCad,
  importChainageFromSurveyCad,
  buildGprLineLengthNarrative,
  parseGprLineRef,
  surveyCadBaselineRows,
} from "./gprLineLengthSummary.js";

describe("gprLineLengthSummary", () => {
  it("parses UMG_LV_B1 line ref like CAD layers", () => {
    const s = parseGprLineRef("UMG_LV_B1");
    expect(s.utilityKey).toBe("lv_cable");
    expect(s.qlKey).toBe("B1");
  });

  it("computes chainage segment length", () => {
    expect(chainageSegmentLengthM(0, 246)).toBe(246);
    expect(chainageSegmentLengthM(100, 76)).toBe(24);
    expect(chainageSegmentLengthM("", "")).toBe(0);
  });

  it("aggregates GPR chainage by utility and QL", () => {
    const report = {
      chainageSegments: [
        { lineRef: "UMG_LV_B1", chainageStartM: 0, chainageEndM: 246 },
        { lineRef: "UMG_HV_B1", chainageStartM: 0, chainageEndM: 76 },
        { lineRef: "UMG_GAS_B2", chainageStartM: 10, chainageEndM: 45 },
      ],
    };
    const v = buildGprLineLengthSummary(report);
    expect(v.totalM).toBe(357);
    expect(v.summary.some((r) => r.utilityKey === "lv_cable" && r.qlKey === "B1" && r.lengthM === 246)).toBe(true);
    expect(v.summary.some((r) => r.utilityKey === "hv_cable" && r.lengthM === 76)).toBe(true);
    expect(v.byUtility.find((u) => u.key === "lv_cable")?.lengthM).toBe(246);
  });

  it("compares GPR totals with survey CAD baseline and notes QL shift", () => {
    const gpr = buildGprLineLengthSummary({
      chainageSegments: [{ lineRef: "UMG_LV_B1", chainageStartM: 0, chainageEndM: 246 }],
    });
    const survey = {
      cadImport: {
        summary: [
          {
            utilityKey: "lv_cable",
            utilityLabel: "LV cable",
            qlKey: "B4",
            pas128Equivalent: "B4",
            lengthM: 300,
            isRecordsDerived: true,
          },
        ],
      },
    };
    const cmp = buildGprSurveyLineComparison(gpr, survey);
    expect(cmp.rows.length).toBeGreaterThan(0);
    expect(cmp.narrative).toMatch(/246 m|246\.0 m|After GPR/i);
    expect(surveyCadBaselineRows(survey).length).toBe(1);
  });

  it("seeds chainage segments from survey CAD layer summary", () => {
    const survey = {
      id: "sr1",
      cadImport: {
        summary: [
          {
            utilityKey: "lv_cable",
            qlKey: "B1",
            lengthM: 246,
            layers: ["UMG_LV_B1"],
          },
          {
            utilityKey: "hv_cable",
            qlKey: "B1",
            lengthM: 76,
            layers: ["UMG_HV_B1"],
          },
        ],
      },
    };
    const segs = chainageSegmentsFromSurveyCad(survey);
    expect(segs).toHaveLength(2);
    expect(segs[0].lineRef).toBe("UMG_LV_B1");
    expect(segs[0].chainageEndM).toBe("246");
    expect(segs[1].lineRef).toBe("UMG_HV_B1");
  });

  it("importChainageFromSurveyCad merges without duplicate line refs", () => {
    const survey = {
      id: "sr1",
      cadImport: {
        summary: [{ utilityKey: "lv_cable", qlKey: "B1", lengthM: 100, layers: ["UMG_LV_B1"] }],
      },
    };
    const gpr = {
      chainageSegments: [{ id: "x", lineRef: "UMG_LV_B1", chainageStartM: 0, chainageEndM: 50 }],
    };
    const merged = importChainageFromSurveyCad(gpr, survey);
    expect(merged.chainageSegments).toHaveLength(1);
    expect(merged.linkedSurveyReportId).toBe("sr1");

    const fresh = importChainageFromSurveyCad({ chainageSegments: [] }, survey);
    expect(fresh.chainageSegments).toHaveLength(1);
    expect(buildGprLineLengthNarrative(fresh, survey)).toMatch(/100/);
  });
});
