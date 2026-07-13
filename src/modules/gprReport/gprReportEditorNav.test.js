import { describe, expect, it } from "vitest";
import { gprTabComplete, firstIncompleteGprTab, gprOverallTabProgress } from "./gprReportEditorNav.js";
import { blankGprReport } from "./gprReportConstants.js";
import { gprPenetrationRisk, gprAntennaAdvice } from "./gprReportHelpers.js";

describe("gprReportEditorNav", () => {
  it("tracks tab progress", () => {
    const r = blankGprReport({ ref: "GPR-1", surveyDate: "2026-01-01", surveyor: "A", siteAddress: "Site" });
    expect(gprTabComplete(r, "setup")).toBe(true);
    expect(gprOverallTabProgress(r).done).toBeGreaterThan(0);
    expect(firstIncompleteGprTab(r)).toBeTruthy();
  });
});

describe("gprPenetrationRisk", () => {
  it("flags when target exceeds expected penetration", () => {
    const r = blankGprReport({
      groundConditions: { expectedPenetrationM: 2 },
      acquisition: { depthRangeM: "3" },
    });
    expect(gprPenetrationRisk(r).level).toBe("risk");
  });
});

describe("gprAntennaAdvice", () => {
  it("recommends lower MHz for deeper targets in clay", () => {
    const r = blankGprReport({
      equipment: [{ antennaFrequencyMhz: 900 }],
      acquisition: { depthRangeM: "3" },
      groundConditions: { attenuationClass: "high" },
    });
    const advice = gprAntennaAdvice(r);
    expect(advice.mhz).toBeLessThan(900);
  });
});
