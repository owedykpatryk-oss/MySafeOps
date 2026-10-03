import { describe, expect, it } from "vitest";
import { blankGprReport } from "./gprReportConstants.js";
import { applyGprFindingsDraft, applyGprNarrativeAutomation, findDuplicateGprNarrativeSections } from "./gprNarrativeAutomation.js";

describe("GPR narrative automation", () => {
  it("keeps the executive summary concise instead of repeating the full anomaly schedule", () => {
    const report = blankGprReport({ anomalies: [
      { ref: "A1", depthM: "0.8", confidence: "medium", interpretation: "Linear reflector on line 4" },
      { ref: "A2", depthM: "1.2", confidence: "low", interpretation: "Weak reflector on line 5" },
    ] });
    const next = applyGprFindingsDraft(report);
    expect(next.sections.executiveSummary).toContain("2 interpreted anomalies");
    expect(next.sections.executiveSummary).not.toContain("Linear reflector on line 4");
    expect(next.sections.findings).toContain("Linear reflector on line 4");
    expect(next.sections.findings).not.toContain("These lines repeat");
  });
  it("does not claim processing was reviewed when no applied workflow was recorded", () => {
    const next = applyGprNarrativeAutomation(blankGprReport({ processing: { software: "Test software", stepsApplied: [], filters: [] } }));
    expect(next.sections.dataProcessing).toContain("Recorded processing software");
    expect(next.sections.dataProcessing).not.toContain("was reviewed");
    expect(next.sections.dataProcessing).toContain("No filter chain was marked as applied");
  });
  it("replaces copied narrative with section-specific content", () => {
    const repeated = "The same copied paragraph was pasted here and contains enough words to be detected as duplicate report content.";
    const report = blankGprReport({
      ref: "GPR-1",
      siteAddress: "Glasgow Airport",
      sections: { foreword: repeated, executiveSummary: repeated, scope: repeated, methodology: repeated },
    });
    const next = applyGprNarrativeAutomation(report);
    expect(new Set([next.sections.foreword, next.sections.executiveSummary, next.sections.scope, next.sections.methodology]).size).toBe(4);
    expect(next.narrativeAutomation.replacedDuplicateSections).toEqual(expect.arrayContaining(["foreword", "scope"]));
  });

  it("preserves distinct user-authored narrative", () => {
    const custom = "A deliberately authored site-specific scope covering the north apron and excluding all operational runway areas.";
    const report = blankGprReport({ sections: { scope: custom } });
    expect(applyGprNarrativeAutomation(report).sections.scope).toBe(custom);
  });

  it("builds detailed acquisition and geology-aware text", () => {
    const report = blankGprReport({
      siteAddress: "Airport corridor",
      acquisition: { scanMode: "route", lineSpacingM: "0.25", traceSpacingM: "0.05", coveragePercent: "96", depthRangeM: "2.5" },
      equipment: [{ manufacturer: "IDS", model: "Stream DP", antennaFrequencyMhz: 600, channels: 19 }],
      groundConditions: { materialClass: "clay_silt", attenuationClass: "high", dielectricRange: [8, 20], expectedPenetrationM: 1.2, scale: "1:50,000", siteObservations: { moisture: "wet", reinforcement: "unknown" } },
    });
    const next = applyGprNarrativeAutomation(report);
    expect(next.sections.executiveSummary).toContain("96% estimated coverage");
    expect(next.sections.methodology).toContain("19 channel(s)");
    expect(next.sections.limitations).toContain("1:50,000");
    expect(next.sections.limitations).toContain("exceeds");
  });

  it("notes a readable signal that stops short of the indicative penetration", () => {
    const report = blankGprReport({
      groundConditions: { expectedPenetrationM: 2.5 },
      scanPanels: [{ readableDepthM: "0.9" }],
    });
    const next = applyGprFindingsDraft(report);
    expect(next.sections.limitations).toContain("0.9 m");
    expect(next.sections.limitations).toContain("2.5 m");
  });

  it("suggests a continuous utility without joining the rows", () => {
    const report = blankGprReport({
      anomalies: [
        { ref: "A1", anomalyType: "utility", lineOrGrid: "Line 2", depthM: "0.80", interpretation: "Hyperbola", confidence: "medium" },
        { ref: "A2", anomalyType: "utility", lineOrGrid: "Line 3", depthM: "0.85", interpretation: "Hyperbola", confidence: "medium" },
      ],
    });
    const next = applyGprFindingsDraft(report);
    expect(next.sections.findings).toContain("may be one continuous feature");
    expect(next.sections.findings).toContain("have not been joined");
    expect(next.anomalies).toHaveLength(2);
  });

  it("drafts findings only from recorded anomaly rows and coverage flags", () => {
    const report = blankGprReport({
      acquisition: { coveragePercent: "70", depthRangeM: "3" },
      groundConditions: { expectedPenetrationM: 1.2 },
      anomalies: [{
        ref: "A1",
        depthM: "0.8",
        confidence: "medium",
        interpretation: "Linear reflector on line 4",
        archiveCorrelation: "correlates",
        archiveFrameDate: "2018-05-16",
      }],
    });
    const next = applyGprFindingsDraft(report);
    expect(next.sections.findings).toContain("A1");
    expect(next.sections.findings).toContain("0.8");
    expect(next.sections.findings).toContain("Linear reflector on line 4");
    expect(next.sections.findings).toContain("2018-05-16");
    expect(next.sections.findings).not.toContain("cemetery");
    expect(next.sections.limitations).toContain("70%");
    expect(next.sections.limitations).toContain("No radargram");
    const empty = applyGprFindingsDraft(blankGprReport());
    expect(empty.sections.findings).toContain("must not be interpreted as clearance");
  });

  it("identifies only substantive duplicate sections", () => {
    const repeated = "This is a substantive duplicate paragraph used across two sections and it must be replaced automatically.";
    expect([...findDuplicateGprNarrativeSections({ foreword: repeated, scope: repeated, findings: "Short" })]).toEqual(["foreword", "scope"]);
  });
});
