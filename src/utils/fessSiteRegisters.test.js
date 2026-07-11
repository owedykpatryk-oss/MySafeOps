/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { seedFessGhpRegister } from "./fessGhpDefaults";
import { seedFessLotoRegister } from "./fessLotoDefaults";
import { seedFessSiteMobilisation } from "./fessSiteMobilisation";
import { seedFessClientSiteProjects } from "./fessClientSites";

describe("fess site registers", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    seedFessClientSiteProjects();
  });

  it("seeds G&HP items per FESS site", () => {
    const first = seedFessGhpRegister();
    expect(first.created).toBeGreaterThan(6);
    expect(seedFessGhpRegister().created).toBe(0);
  });

  it("seeds LOTO templates per FESS site", () => {
    const first = seedFessLotoRegister();
    expect(first.created).toBeGreaterThan(5);
    expect(seedFessLotoRegister().created).toBe(0);
  });

  it("mobilises a single site with registers and briefing", () => {
    const result = seedFessSiteMobilisation("fess_site_quorn");
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Quorn/i);
  });
});
