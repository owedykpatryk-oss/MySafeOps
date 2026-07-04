/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { FOOD_PHARMA_SETUP_STEPS, getFoodPharmaSetupStatus } from "./foodPharmaOnboarding";

describe("foodPharmaOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({ industryPackId: "foodPharma" });
  });

  it("defines setup steps", () => {
    expect(FOOD_PHARMA_SETUP_STEPS.length).toBeGreaterThanOrEqual(8);
  });

  it("getFoodPharmaSetupStatus returns pct", () => {
    const status = getFoodPharmaSetupStatus();
    expect(status.total).toBe(FOOD_PHARMA_SETUP_STEPS.length);
    expect(status.pct).toBeGreaterThanOrEqual(0);
  });
});
