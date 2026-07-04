/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  CONSTRUCTION_SETUP_STEPS,
  getConstructionSetupStatus,
  markConstructionStepDone,
  runConstructionSetupAction,
  isConstructionPackActive,
} from "./constructionOnboarding";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("constructionOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({ industryPackId: "generalContractor" });
  });

  it("defines setup steps", () => {
    expect(CONSTRUCTION_SETUP_STEPS.length).toBeGreaterThanOrEqual(8);
  });

  it("getConstructionSetupStatus returns pct", () => {
    const status = getConstructionSetupStatus();
    expect(status.total).toBe(CONSTRUCTION_SETUP_STEPS.length);
    expect(status.pct).toBeGreaterThanOrEqual(0);
  });

  it("markConstructionStepDone updates progress", () => {
    markConstructionStepDone("cdm_pack");
    const status = getConstructionSetupStatus();
    expect(status.steps.find((s) => s.id === "cdm_pack")?.done).toBe(true);
  });

  it("runConstructionSetupAction seeds legislation", () => {
    const result = runConstructionSetupAction("legislation");
    expect(result.ok).toBe(true);
  });

  it("isConstructionPackActive for generalContractor", () => {
    expect(isConstructionPackActive()).toBe(true);
  });
});
