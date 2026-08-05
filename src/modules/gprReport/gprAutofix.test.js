import { describe, expect, it } from "vitest";
import { blankGprReport } from "./gprReportConstants";
import { applyGprAutofix, suggestGprAutofixes } from "./gprAutofix";
import { buildGprBlockers } from "./gprReportBlockers";

describe("gprAutofix", () => {
  it("suggests velocity and coverage when empty", () => {
    const report = blankGprReport({
      velocityModel: { assumedVelocityCmNs: "", measuredVelocityCmNs: "" },
      acquisition: { coveragePercent: "" },
    });
    const ids = suggestGprAutofixes(report);
    expect(ids).toContain("velocity_default");
    expect(ids).toContain("coverage_default");
  });

  it("sets assumed velocity 10 cm/ns", () => {
    const report = blankGprReport({
      velocityModel: { assumedVelocityCmNs: "", measuredVelocityCmNs: "" },
    });
    const next = applyGprAutofix("velocity_default", report);
    expect(next?.velocityModel?.assumedVelocityCmNs).toBe(10);
  });

  it("sets coverage percent", () => {
    const report = blankGprReport({ acquisition: { coveragePercent: "" } });
    const next = applyGprAutofix("coverage_default", report);
    expect(next?.acquisition?.coveragePercent).toBe("100");
  });
});

describe("gprReportBlockers", () => {
  it("flags missing radargrams and low score", () => {
    const report = blankGprReport({ status: "draft", ref: "" });
    const { blockers, score } = buildGprBlockers(report);
    expect(score).toBeLessThan(70);
    expect(blockers.some((b) => b.id === "no_radargrams")).toBe(true);
    expect(blockers.some((b) => b.severity === "block")).toBe(true);
  });
});
