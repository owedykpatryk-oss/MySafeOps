/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { listWorkspaceProfilesForOrg } from "./customWorkspaceProfiles";
import { isValidIndustryPackId, applyIndustryPack, getAppliedIndustryPackId } from "./orgIndustryPacks";
import {
  FESS_FOCUS_HIDDEN_MODULES,
  FESS_GROUP_PACK_ID,
  getFessGroupWorkspacePack,
} from "./fessWorkspaceProfile";
import { setOrgId } from "./orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("FESS exclusive workspace profile", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org", hiddenModules: [], hiddenModulesBootstrapped: true });
  });

  it("lists fessGroup profile only for FESS org", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", hiddenModules: [], hiddenModulesBootstrapped: true });
    const ids = listWorkspaceProfilesForOrg().map((p) => p.id);
    expect(ids).toContain(FESS_GROUP_PACK_ID);
  });

  it("hides fessGroup profile from other orgs", () => {
    const ids = listWorkspaceProfilesForOrg().map((p) => p.id);
    expect(ids).not.toContain(FESS_GROUP_PACK_ID);
    expect(isValidIndustryPackId(FESS_GROUP_PACK_ID)).toBe(false);
  });

  it("applies fessGroup profile for FESS org", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", hiddenModules: [], hiddenModulesBootstrapped: true });
    applyIndustryPack(FESS_GROUP_PACK_ID, { seedTemplates: false });
    expect(getAppliedIndustryPackId()).toBe(FESS_GROUP_PACK_ID);
  });

  it("hides sales/survey noise but keeps field-ops modules", () => {
    const pack = getFessGroupWorkspacePack();
    for (const id of FESS_FOCUS_HIDDEN_MODULES) {
      expect(pack.hiddenModules).toContain(id);
    }
    for (const id of ["geo-photos", "scaffold", "asbestos", "noise", "monthly-report", "rams"]) {
      expect(pack.hiddenModules).not.toContain(id);
      expect(pack.showModules).toContain(id);
    }
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", hiddenModules: [], hiddenModulesBootstrapped: true });
    applyIndustryPack(FESS_GROUP_PACK_ID, { seedTemplates: false });
    const hidden = loadOrgSettingsRaw().hiddenModules || [];
    expect(hidden).toContain("sales-enablement");
    expect(hidden).toContain("survey-report");
    expect(hidden).not.toContain("geo-photos");
    expect(hidden).not.toContain("monthly-report");
  });
});
