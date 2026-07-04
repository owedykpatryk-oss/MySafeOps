/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  GEOSPATIAL_SETUP_STEPS,
  getGeospatialSetupStatus,
  isGeospatialPackActive,
  runGeospatialSetupAction,
} from "./geospatialOnboarding";

describe("geospatialOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({ industryPackId: "surveyingGeodesy" });
  });

  it("defines geospatial setup steps", () => {
    expect(GEOSPATIAL_SETUP_STEPS.length).toBeGreaterThanOrEqual(6);
  });

  it("isGeospatialPackActive for surveyingGeodesy", () => {
    expect(isGeospatialPackActive()).toBe(true);
  });

  it("runGeospatialSetupAction applies workspace profile", () => {
    const result = runGeospatialSetupAction("workspace_profile");
    expect(result.ok).toBe(true);
  });

  it("runGeospatialSetupAction seeds surveying and GI quick packs", () => {
    const result = runGeospatialSetupAction("geospatial_packs");
    expect(result.ok).toBe(true);
    const status = getGeospatialSetupStatus();
    expect(status.steps.find((s) => s.id === "geospatial_packs")?.done).toBe(true);
  });
});
