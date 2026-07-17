/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import {
  mapGprAnomalyToSurveyCard,
  importGprReportIntoSurvey,
  matchRadargramForAnomaly,
  listGprReportsForSurveyProject,
} from "./surveyGprBridge";
import { blankSurveyReport } from "./surveyReportConstants";

describe("surveyGprBridge", () => {
  it("maps utility anomaly to linear card with depth", () => {
    const card = mapGprAnomalyToSurveyCard({
      id: "a1",
      ref: "A-01",
      anomalyType: "utility",
      depthM: "1.2",
      interpretation: "Possible duct",
      confidence: "high",
      lineOrGrid: "L3",
    });
    expect(card.classKey).toBe("linear");
    expect(card.ref).toBe("A-01");
    expect(card.depthMinM).toBe("1.2");
    expect(card.interpretation).toMatch(/Possible duct/);
    expect(card.sourceGprAnomalyId).toBe("a1");
  });

  it("matches radargram by line ref", () => {
    const rg = matchRadargramForAnomaly(
      { lineOrGrid: "L3" },
      [
        { id: "r1", lineRef: "L2", dataUrl: "data:x" },
        { id: "r2", lineRef: "L3", dataUrl: "data:y" },
      ]
    );
    expect(rg.id).toBe("r2");
  });

  it("imports anomalies without duplicating by source id", () => {
    const survey = blankSurveyReport({
      gprAnomalyCards: [
        {
          id: "existing",
          ref: "A-01",
          classKey: "linear",
          sourceGprAnomalyId: "a1",
          interpretation: "old",
        },
      ],
    });
    const gpr = {
      id: "gpr1",
      ref: "GPR-1",
      anomalies: [
        { id: "a1", ref: "A-01", anomalyType: "utility", depthM: "0.8", interpretation: "new" },
        { id: "a2", ref: "A-02", anomalyType: "void", depthM: "1.5", interpretation: "void" },
      ],
      sections: { findings: "Two targets require trial holes." },
      radargrams: [],
    };
    const next = importGprReportIntoSurvey(survey, gpr);
    expect(next.linkedGprReportId).toBe("gpr1");
    expect(next.gprAnomalyCards).toHaveLength(2);
    expect(next.gprAnomalyCards.some((c) => c.ref === "A-02")).toBe(true);
    expect(next.gprConclusions).toMatch(/trial holes/i);
  });

  it("lists project GPR reports with anomalies first", () => {
    const list = listGprReportsForSurveyProject(
      [
        { id: "1", projectId: "p1", anomalies: [] },
        { id: "2", projectId: "p1", anomalies: [{ id: "a" }] },
        { id: "3", projectId: "p2", anomalies: [{ id: "b" }] },
      ],
      "p1"
    );
    expect(list.map((g) => g.id)).toEqual(["2", "1"]);
  });
});
