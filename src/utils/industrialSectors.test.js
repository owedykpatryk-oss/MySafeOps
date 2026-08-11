import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  getSelectedIndustrySectors,
  orgHasPharmaPack,
  orgHasSurveyingSectorSelected,
  orgPharmaSectorBannerActive,
  orgSectorSelected,
  INDUSTRY_SECTOR_OPTIONS,
  SURVEYING_SECTOR_IDS,
} from "./industrialSectors.js";

vi.mock("./orgMembership.js", () => ({
  isTrialUnlockActive: vi.fn(() => false),
}));

vi.mock("./orgSettingsStorage.js", () => ({
  getOrgSettings: vi.fn(() => ({ industrySectors: ["construction"] })),
}));

import { isTrialUnlockActive } from "./orgMembership.js";
import { getOrgSettings } from "./orgSettingsStorage.js";

describe("industrialSectors", () => {
  beforeEach(() => {
    vi.mocked(isTrialUnlockActive).mockReturnValue(false);
    vi.mocked(getOrgSettings).mockReturnValue({ industrySectors: ["construction"] });
  });

  it("exposes expanded sector list including surveying", () => {
    expect(INDUSTRY_SECTOR_OPTIONS.length).toBeGreaterThanOrEqual(22);
    expect([...SURVEYING_SECTOR_IDS]).toEqual(
      expect.arrayContaining(["surveying_pas128", "surveying_topo", "surveying_geospatial", "surveying_gpr"])
    );
  });

  it("detects surveying trade ticks", () => {
    expect(orgHasSurveyingSectorSelected(["construction"])).toBe(false);
    expect(orgHasSurveyingSectorSelected(["construction", "surveying_topo"])).toBe(true);
  });

  it("pharma banner only when pharma selected", () => {
    expect(orgPharmaSectorBannerActive()).toBe(false);
    vi.mocked(getOrgSettings).mockReturnValue({ industrySectors: ["construction", "pharma"] });
    expect(orgPharmaSectorBannerActive()).toBe(true);
    expect(orgSectorSelected("pharma")).toBe(true);
  });

  it("trial unlocks features but not banner state", () => {
    vi.mocked(isTrialUnlockActive).mockReturnValue(true);
    vi.mocked(getOrgSettings).mockReturnValue({ industrySectors: ["construction"] });
    expect(orgHasPharmaPack()).toBe(true);
    expect(orgPharmaSectorBannerActive()).toBe(false);
  });

  it("defaults to construction when empty", () => {
    vi.mocked(getOrgSettings).mockReturnValue({ industrySectors: [] });
    expect(getSelectedIndustrySectors()).toEqual(["construction"]);
  });
});
