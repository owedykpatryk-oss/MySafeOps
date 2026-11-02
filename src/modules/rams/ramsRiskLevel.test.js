import { describe, expect, it } from "vitest";
import { getRiskLevel, getRiskScore, isValidRiskAssessment } from "./ramsRiskLevel";

describe("RAMS risk assessment integrity", () => {
  it("never labels invalid or unassessed risks as low", () => {
    for (const risk of [null, {}, { RF: null }, { RF: "" }, { RF: false }, { RF: 0 },
      { RF: Infinity }, { RF: 37 }, { L: true, S: 6, RF: 6 }, { L: 0, S: 6, RF: 12 }, { L: 2, S: null, RF: 12 }]) {
      expect(getRiskLevel(risk)).toBe("unknown");
      expect(isValidRiskAssessment(risk)).toBe(false);
    }
  });
  it("uses axes consistently even if a saved RF is stale", () => {
    expect(getRiskScore({ L: 2, S: 6, RF: 24 })).toBe(12);
    expect(getRiskLevel({ L: 2, S: 6, RF: 24 })).toBe("medium");
    expect(isValidRiskAssessment({ L: 2, S: 6, RF: 24 })).toBe(false);
    expect(isValidRiskAssessment({ L: 2, S: 6, RF: 12 })).toBe(true);
  });
  it("preserves all existing axis values and RF-only band callers", () => {
    expect(isValidRiskAssessment({ L: 3, S: 5, RF: 15 })).toBe(true);
    expect(getRiskLevel({ RF: 8 })).toBe("low");
    expect(getRiskLevel({ RF: 12 })).toBe("medium");
    expect(getRiskLevel({ RF: 24 })).toBe("high");
  });
});
