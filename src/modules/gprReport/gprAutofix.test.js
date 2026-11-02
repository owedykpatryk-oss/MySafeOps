import { describe, expect, it } from "vitest";
import { blankGprReport } from "./gprReportConstants";
import { applyGprAutofix, suggestGprAutofixes } from "./gprAutofix";
import { buildGprBlockers } from "./gprReportBlockers";

describe("gprAutofix", () => {
  it("suggests assumed velocity but never invents coverage or QA sign-off", () => {
    const report = blankGprReport({
      velocityModel: { assumedVelocityCmNs: "", measuredVelocityCmNs: "" },
      acquisition: { coveragePercent: "" },
    });
    const ids = suggestGprAutofixes(report);
    expect(ids).toContain("velocity_default");
    expect(ids).not.toContain("coverage_default");
    expect(ids).not.toContain("qa_core_ticks");
  });

  it("sets assumed velocity 10 cm/ns", () => {
    const report = blankGprReport({
      velocityModel: { assumedVelocityCmNs: "", measuredVelocityCmNs: "" },
    });
    const next = applyGprAutofix("velocity_default", report);
    expect(next?.velocityModel?.assumedVelocityCmNs).toBe(10);
  });

  it("rejects legacy fixes that assert coverage or QA without evidence", () => {
    const report = blankGprReport({ acquisition: { coveragePercent: "" } });
    const before = structuredClone(report);
    expect(applyGprAutofix("coverage_default", report)).toBeNull();
    expect(applyGprAutofix("qa_core_ticks", report)).toBeNull();
    expect(report).toEqual(before);
  });
});

describe("gprReportBlockers", () => {
  it("flags missing radargrams and low score", () => {
    const report = blankGprReport({ status: "draft", ref: "" });
    const { blockers, score } = buildGprBlockers(report);
    expect(score).toBeLessThan(70);
    expect(blockers.some((b) => b.id === "no_radargrams")).toBe(true);
    expect(blockers.some((b) => b.id === "no_start")).toBe(true);
    expect(blockers.some((b) => b.severity === "block")).toBe(true);
  });

  it("blocks invalid coverage and incomplete or duplicate anomaly references", () => {
    const report = blankGprReport({
      acquisition: { scanMode: "grid", coveragePercent: 120 },
      anomalies: [
        { ref: "A1", interpretation: "Linear response", confidence: "high" },
        { ref: "A1", interpretation: "", confidence: "medium" },
      ],
    });
    const ids = buildGprBlockers(report).blockers.map((b) => b.id);
    expect(ids).toContain("coverage_invalid");
    expect(ids).toContain("duplicate_anomaly_refs");
    expect(ids).toContain("incomplete_anomalies");
  });

  it("warns when target depth exceeds the geology-informed penetration", () => {
    const report = blankGprReport({
      includeGeology: true,
      acquisition: { scanMode: "grid", depthRangeM: 3 },
      groundConditions: { expectedPenetrationM: 1.2 },
    });
    expect(buildGprBlockers(report).blockers.some((b) => b.id === "penetration_exceeded")).toBe(true);
    expect(buildGprBlockers({ ...report, includeGeology: false }).blockers.some((b) => b.id === "penetration_exceeded")).toBe(false);
  });
});
