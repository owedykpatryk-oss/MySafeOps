/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  clearIndustryPackPreview,
  getIndustryPackPreviewId,
  setIndustryPackPreview,
} from "./industryPackPreview";
import { getOrgIndustryPackId } from "./projectHubIndustry";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack } from "./orgIndustryPacks";

describe("industryPackPreview", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
    clearIndustryPackPreview();
  });

  it("stores preview id in session", () => {
    setIndustryPackPreview("surveyingGeodesy");
    expect(getIndustryPackPreviewId()).toBe("surveyingGeodesy");
  });

  it("rejects invalid preview ids", () => {
    setIndustryPackPreview("not-valid");
    expect(getIndustryPackPreviewId()).toBeNull();
  });

  it("getOrgIndustryPackId prefers preview over applied", () => {
    applyIndustryPack("generalContractor");
    setIndustryPackPreview("electricalContractor");
    expect(getOrgIndustryPackId()).toBe("electricalContractor");
  });

  it("clearIndustryPackPreview falls back to applied pack", () => {
    applyIndustryPack("buildingTrades");
    setIndustryPackPreview("electricalContractor");
    clearIndustryPackPreview();
    expect(getOrgIndustryPackId()).toBe("buildingTrades");
  });
});
