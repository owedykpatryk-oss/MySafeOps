/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { buildFessJobStarterFormPatch, getHazardsForFessJobStarter, getFessMeBaselineHazards } from "./fessRamsWorkflow";
import ALL from "../modules/rams/ramsAllHazards.js";

describe("fessRamsWorkflow", () => {
  const project = {
    id: "proj_1",
    name: "2SFG Scunthorpe — production lines",
    client: "2 Sisters Food Group",
    address: "2SFG Scunthorpe, UK",
    location: "2SFG Scunthorpe",
  };

  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("builds RAMS form patch from job starter", () => {
    const patch = buildFessJobStarterFormPatch("dolav_meyn", project);
    expect(patch?.title).toMatch(/DOLAV/i);
    expect(patch?.scope).toMatch(/MEYN/i);
    expect(patch?.surveyMethodStatement).toMatch(/Validate/i);
    expect(patch?.jobRef).toMatch(/^FP1-DOLAV-/);
    expect(patch?.fessJobStarterKey).toBe("dolav_meyn");
    expect(patch?.communicationPlan).toMatch(/line clearance/i);
  });

  it("returns hazards for FESS org only", () => {
    const hazards = getHazardsForFessJobStarter("machine_install", ALL);
    expect(hazards.length).toBeGreaterThan(20);
    expect(hazards.some((h) => h.id === "mach_002")).toBe(true);

    setOrgId("acme");
    saveOrgSettingsRaw({ name: "Acme Ltd" });
    expect(getHazardsForFessJobStarter("machine_install", ALL)).toEqual([]);
  });

  it("returns null patch for unknown starter", () => {
    expect(buildFessJobStarterFormPatch("missing")).toBeNull();
  });

  it("returns baseline hazards for FESS org", () => {
    const baseline = getFessMeBaselineHazards(ALL);
    expect(baseline.length).toBeGreaterThan(20);
    expect(baseline.some((h) => h.id === "gen_001")).toBe(true);
  });
});
