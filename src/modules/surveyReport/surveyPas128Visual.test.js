import { describe, expect, it } from "vitest";
import { pas128DonutSegments } from "./surveyPas128Visual";
import { getSurveyMilestones, surveyMilestoneProgress } from "./surveyMilestones";
import { blankSurveyReport } from "./surveyReportConstants";

describe("surveyPas128Visual", () => {
  it("builds donut segments totalling 100%", () => {
    const segs = pas128DonutSegments({ B1: 3, B2: 2 });
    expect(segs.reduce((n, s) => n + s.pct, 0)).toBeCloseTo(100, 1);
    expect(segs.find((s) => s.ql === "B1")?.count).toBe(3);
  });
});

describe("surveyMilestones", () => {
  it("tracks milestone progress for blank report", () => {
    const ms = getSurveyMilestones(blankSurveyReport());
    const p = surveyMilestoneProgress(ms);
    expect(p.total).toBe(6);
    expect(p.done).toBeLessThan(p.total);
  });
});
