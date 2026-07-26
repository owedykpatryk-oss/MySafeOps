/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  TRADE_RAMS_STARTERS,
  getOrgRamsStarterKey,
  getRamsStarterAiHint,
  getRamsStarterLabel,
  isSurveyRamsStarterKey,
  hazardMatchesStarterTokens,
  findHazardsForStarterTokens,
} from "./ramsIndustryStarters";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("ramsIndustryStarters", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("buildPortalSnapshot scopes rows by projectId", () => {
    expect(isSurveyRamsStarterKey("utility_mapping_survey")).toBe(true);
    expect(isSurveyRamsStarterKey("general")).toBe(false);
  });

  it("getOrgRamsStarterKey reads saved key then pack default", () => {
    saveOrgSettingsRaw({ industryPackId: "electricalContractor", ramsStarterKey: "electrical" });
    expect(getOrgRamsStarterKey()).toBe("electrical");

    saveOrgSettingsRaw({ industryPackId: "demolitionStripout" });
    expect(getOrgRamsStarterKey()).toBe("demolition");

    saveOrgSettingsRaw({ industryPackId: "showEverything", ramsStarterKey: null });
    expect(getOrgRamsStarterKey()).toBe(null);
  });

  it("getRamsStarterLabel and AI hint reflect starter", () => {
    expect(getRamsStarterLabel("refurb_build")).toMatch(/refurb/i);
    expect(getRamsStarterAiHint("electrical")).toMatch(/Electrical/i);
    expect(getRamsStarterAiHint("utility_mapping_survey")).toMatch(/PAS128/i);
  });

  it("matches hazards by starter tokens", () => {
    const lib = [
      { id: "1", category: "Electrical", activity: "Isolation", hazard: "Live cable contact" },
      { id: "2", category: "General", activity: "Lifting", hazard: "Manual handling strain" },
    ];
    const tokens = TRADE_RAMS_STARTERS.electrical.hazardTokens;
    expect(hazardMatchesStarterTokens(lib[0], tokens)).toBe(true);
    const found = findHazardsForStarterTokens(tokens, lib, 5);
    expect(found.some((h) => h.id === "1")).toBe(true);
  });
});
