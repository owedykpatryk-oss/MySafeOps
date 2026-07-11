/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { computeFessRamsCompleteness } from "./fessRamsCompleteness";
import { getFessStarterHazardIds } from "./fessJobStarters";
import ALL from "../modules/rams/ramsAllHazards.js";

describe("fessRamsCompleteness", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("returns null for non-FESS org", () => {
    setOrgId("acme");
    expect(computeFessRamsCompleteness({}, [])).toBeNull();
  });

  it("scores incomplete RAMS with missing hazards", () => {
    const form = {
      title: "RAMS test",
      scope: "Scope",
      surveyMethodStatement: "Method",
      jobRef: "FP1-2026-001",
      client: "2SFG",
      location: "Scunthorpe",
      fessJobStarterKey: "dolav_meyn",
    };
    const result = computeFessRamsCompleteness(form, [], { library: ALL });
    expect(result?.score).toBeLessThan(85);
    expect(result?.missingIds.length).toBeGreaterThan(0);
    expect(result?.band).toBe("incomplete");
  });

  it("scores high when all expected hazards present", () => {
    const form = {
      title: "RAMS test",
      scope: "Scope",
      surveyMethodStatement: "Method",
      jobRef: "FP1-2026-001",
      client: "2SFG",
      location: "Scunthorpe",
      fessJobStarterKey: "dolav_meyn",
    };
    const ids = getFessStarterHazardIds("dolav_meyn", "fess_site_2sfg_scunthorpe");
    const rows = ALL.filter((h) => ids.includes(h.id)).map((h) => ({
      ...h,
      sourceId: h.id,
      initialRisk: h.initialRisk,
      revisedRisk: h.revisedRisk,
    }));
    const result = computeFessRamsCompleteness(form, rows, {
      siteTemplateId: "fess_site_2sfg_scunthorpe",
      library: ALL,
    });
    expect(result?.missingIds.length).toBe(0);
    expect(result?.score).toBeGreaterThanOrEqual(85);
  });
});
