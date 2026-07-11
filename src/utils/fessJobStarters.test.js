/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  FESS_JOB_STARTERS,
  getFessJobStarter,
  getFessStarterHazardIds,
  listFessJobStarters,
} from "./fessJobStarters";

describe("fessJobStarters", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("lists sixteen MC-derived job starters", () => {
    expect(listFessJobStarters()).toHaveLength(19);
    expect(FESS_JOB_STARTERS.map((s) => s.key)).toContain("dolav_meyn");
    expect(FESS_JOB_STARTERS.map((s) => s.key)).toContain("spiral_conveyor");
  });

  it("returns starter metadata for known keys", () => {
    const starter = getFessJobStarter("pipe_changeover");
    expect(starter?.client).toMatch(/Cranswick/i);
    expect(starter?.permitTypes).toContain("loto");
    expect(starter?.methodStatement).toMatch(/roof void/i);
  });

  it("merges baseline and supplemental hazard ids without duplicates", () => {
    const ids = getFessStarterHazardIds("dolav_meyn");
    expect(ids.length).toBeGreaterThan(20);
    expect(ids).toContain("gen_001");
    expect(ids).toContain("mach_001");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("merges site-specific baseline for 2SFG Scunthorpe", () => {
    const ids = getFessStarterHazardIds("dolav_meyn", "fess_site_2sfg_scunthorpe");
    expect(ids).toContain("fess_001");
    expect(ids).toContain("fess_009");
    expect(ids.length).toBeGreaterThan(25);
  });

  it("returns null for unknown starter key", () => {
    expect(getFessJobStarter("unknown_job")).toBeNull();
    expect(getFessStarterHazardIds("unknown_job").length).toBeGreaterThan(20);
  });

  it("returns empty list for non-FESS org", () => {
    setOrgId("acme-ltd");
    saveOrgSettingsRaw({ name: "Acme Ltd" });
    expect(listFessJobStarters()).toEqual([]);
    expect(getFessJobStarter("dolav_meyn")).toBeNull();
  });
});
