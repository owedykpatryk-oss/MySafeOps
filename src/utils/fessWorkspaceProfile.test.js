/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { listWorkspaceProfilesForOrg } from "./customWorkspaceProfiles";
import { isValidIndustryPackId, applyIndustryPack, getAppliedIndustryPackId } from "./orgIndustryPacks";
import { FESS_GROUP_PACK_ID } from "./fessWorkspaceProfile";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

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
});
