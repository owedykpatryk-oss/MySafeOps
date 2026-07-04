/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { saveOrgSettingsRaw, loadOrgSettingsRaw } from "./orgSettingsStorage";
import { pickCloudBrandingPayload } from "./orgSettingsStorage";
import {
  createCustomWorkspaceProfile,
  deleteCustomWorkspaceProfile,
  duplicateCustomWorkspaceProfile,
  getCustomWorkspaceProfile,
  isCustomWorkspacePackId,
  listWorkspaceProfilesForOrg,
  resolveProfileBehaviorPackId,
  resolveWorkspacePack,
  updateCustomWorkspaceProfile,
  visibleModulesForProfile,
} from "./customWorkspaceProfiles";

describe("customWorkspaceProfiles", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "org-a");
  });

  it("creates org-private custom profile", () => {
    const profile = createCustomWorkspaceProfile({ label: "My mix", basedOn: "generalContractor" });
    expect(isCustomWorkspacePackId(profile.id)).toBe(true);
    expect(resolveWorkspacePack(profile.id)?.label).toBe("My mix");
  });

  it("persists custom profiles in org settings for cloud sync", () => {
    createCustomWorkspaceProfile({ label: "Cloud profile" });
    const raw = loadOrgSettingsRaw();
    expect(Array.isArray(raw.customWorkspaceProfiles)).toBe(true);
    expect(raw.customWorkspaceProfiles.length).toBe(1);
    const payload = pickCloudBrandingPayload(raw);
    expect(payload.customWorkspaceProfiles?.length).toBe(1);
  });

  it("updates profile modules and survey workflow", () => {
    const profile = createCustomWorkspaceProfile({ label: "Survey mix", basedOn: "generalContractor" });
    updateCustomWorkspaceProfile(profile.id, {
      surveyWorkflow: true,
      visibleModuleIds: ["survey-report", "geo-photos", "daily-briefing"],
    });
    const updated = getCustomWorkspaceProfile(profile.id);
    expect(updated?.surveyWorkflow).toBe(true);
    expect(visibleModulesForProfile(updated)).toContain("survey-report");
    expect(resolveProfileBehaviorPackId(profile.id)).toBe("surveyingGeodesy");
  });

  it("duplicates custom profile", () => {
    const profile = createCustomWorkspaceProfile({ label: "Original" });
    const copy = duplicateCustomWorkspaceProfile(profile.id);
    expect(copy.id).not.toBe(profile.id);
    expect(copy.label).toContain("copy");
    expect(listWorkspaceProfilesForOrg().filter((p) => p.custom).length).toBe(2);
  });

  it("custom profiles are isolated per org", () => {
    createCustomWorkspaceProfile({ label: "Org A only" });
    localStorage.setItem("mysafeops_orgId", "org-b");
    const listB = listWorkspaceProfilesForOrg();
    expect(listB.some((p) => p.custom)).toBe(false);
  });

  it("deletes custom profile", () => {
    const profile = createCustomWorkspaceProfile({ label: "Temp" });
    expect(deleteCustomWorkspaceProfile(profile.id)).toBe(true);
    expect(getCustomWorkspaceProfile(profile.id)).toBeNull();
  });
});
