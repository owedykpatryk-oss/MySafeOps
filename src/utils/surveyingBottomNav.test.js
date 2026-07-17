/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  SURVEYING_BOTTOM_NAV_IDS,
  buildSurveyingBottomNavTabDefs,
  isSurveyingBottomNavActive,
} from "./surveyingBottomNav";

describe("surveyingBottomNav", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org", industryPackId: "generalContractor" });
  });

  it("is inactive for non-surveying orgs", () => {
    expect(isSurveyingBottomNavActive()).toBe(false);
  });

  it("is active for Utility Mapping", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    expect(isSurveyingBottomNavActive()).toBe(true);
  });

  it("is active for geospatial industry packs", () => {
    saveOrgSettingsRaw({ name: "Survey Co", industryPackId: "surveyingGeodesy" });
    expect(isSurveyingBottomNavActive()).toBe(true);
  });

  it("includes GPR report in fixed bottom destinations", () => {
    expect(SURVEYING_BOTTOM_NAV_IDS).toEqual([
      "projects",
      "rams",
      "survey-report",
      "gpr-report",
      "geo-photos",
    ]);
    const ids = buildSurveyingBottomNavTabDefs("uk").map((t) => t.id);
    expect(ids).toContain("gpr-report");
    expect(ids[ids.length - 1]).toBe("more");
  });
});
