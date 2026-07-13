/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  WORKSPACE_PROFILE_OVERVIEW,
  PROFILE_GUIDE_ENTRIES,
  getProfileGuideEntry,
  getActiveProfileGuideSummary,
  listProfileGuideCatalogue,
  getWorkspaceProfileOverview,
} from "./workspaceProfileGuide";
import { INDUSTRY_PACKS } from "./orgIndustryPacks";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("workspaceProfileGuide", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("has guide entry for every industry pack", () => {
    for (const id of Object.keys(INDUSTRY_PACKS)) {
      expect(PROFILE_GUIDE_ENTRIES[id]).toBeDefined();
      expect(PROFILE_GUIDE_ENTRIES[id].tagline.length).toBeGreaterThan(10);
    }
  });

  it("overview copy is complete", () => {
    expect(WORKSPACE_PROFILE_OVERVIEW.whatItDoes.length).toBeGreaterThanOrEqual(4);
    expect(WORKSPACE_PROFILE_OVERVIEW.changeSteps.length).toBeGreaterThanOrEqual(4);
  });

  it("getProfileGuideEntry reflects applied pack", () => {
    saveOrgSettingsRaw({ industryPackId: "electricalContractor" });
    const entry = getProfileGuideEntry();
    expect(entry.label).toMatch(/Electrical/i);
    expect(entry.ramsNote).toMatch(/Electrical/i);
  });

  it("getActiveProfileGuideSummary includes workflow and site pack", () => {
    saveOrgSettingsRaw({ industryPackId: "surveyingGeodesy" });
    const summary = getActiveProfileGuideSummary();
    expect(summary.sitePackTitle).toMatch(/Survey/i);
    expect(summary.steps.length).toBeGreaterThan(0);
  });

  it("listProfileGuideCatalogue matches pack count", () => {
    expect(listProfileGuideCatalogue()).toHaveLength(Object.keys(INDUSTRY_PACKS).length);
  });

  it("getWorkspaceProfileOverview uses SWMS for AU", () => {
    const overview = getWorkspaceProfileOverview("au");
    expect(overview.whatItDoes.join(" ")).toMatch(/SWMS/i);
    expect(overview.whatItDoes.join(" ")).not.toMatch(/\bRAMS\b/);
  });

  it("getProfileGuideEntry localizes hub focus for AU", () => {
    const entry = getProfileGuideEntry("generalContractor", "au");
    expect(entry.hubFocus).toMatch(/WHS|SWMS/i);
  });
});
