/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { ensureFessWorkspaceFocus } from "./ensureFessWorkspaceFocus";
import {
  FESS_FOCUS_HIDDEN_MODULES,
  FESS_GROUP_PACK_ID,
  FESS_KEEP_VISIBLE_MODULES,
} from "./fessWorkspaceProfile";
import { RAMS_FEATURES } from "./ramsFeatureIds";

describe("ensureFessWorkspaceFocus", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org", hiddenModules: [], hiddenModulesBootstrapped: true });
  });

  it("does nothing for non-FESS orgs", () => {
    expect(ensureFessWorkspaceFocus()).toBe(false);
  });

  it("applies pack id, hides and keep-visible modules for FESS", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({
      name: "FESS Group",
      industryPackId: "generalContractor",
      hiddenModules: ["geo-photos", "monthly-report"],
      hiddenModulesBootstrapped: true,
    });
    expect(ensureFessWorkspaceFocus()).toBe(true);
    const raw = loadOrgSettingsRaw();
    expect(raw.industryPackId).toBe(FESS_GROUP_PACK_ID);
    for (const id of FESS_FOCUS_HIDDEN_MODULES) {
      expect(raw.hiddenModules).toContain(id);
    }
    for (const id of ["geo-photos", "scaffold", "asbestos", "noise", "monthly-report"]) {
      expect(raw.hiddenModules).not.toContain(id);
      expect(FESS_KEEP_VISIBLE_MODULES).toContain(id);
    }
    expect(raw.hiddenFeatures).toContain(RAMS_FEATURES.SURVEYING);
  });

  it("is idempotent once applied", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", hiddenModules: [], hiddenModulesBootstrapped: true });
    expect(ensureFessWorkspaceFocus()).toBe(true);
    expect(ensureFessWorkspaceFocus()).toBe(false);
  });
});
