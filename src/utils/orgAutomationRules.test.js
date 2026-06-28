/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeOrgAutomationRules,
  isAutomationEnabled,
  projectRamsCheckForPermit,
  saveOrgAutomationRules,
  DEFAULT_ORG_AUTOMATION_RULES,
} from "./orgAutomationRules";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("orgAutomationRules", () => {
  beforeEach(() => {
    saveOrgSettingsRaw({});
  });

  it("merges defaults with stored overrides", () => {
    const rules = normalizeOrgAutomationRules({ surveyFinalGate: false, staleSurveyReminderDays: 7 });
    expect(rules.surveyFinalGate).toBe(false);
    expect(rules.surveyExportGate).toBe(true);
    expect(rules.staleSurveyReminderDays).toBe(7);
  });

  it("isAutomationEnabled reads persisted rules", () => {
    saveOrgAutomationRules({ ptwRequiresProjectRams: false });
    expect(isAutomationEnabled("ptwRequiresProjectRams")).toBe(false);
    expect(isAutomationEnabled("surveyFinalGate")).toBe(true);
  });

  it("projectRamsCheckForPermit respects PTW rule toggle", () => {
    saveOrgAutomationRules({ ptwRequiresProjectRams: false });
    expect(projectRamsCheckForPermit("p1", false)).toEqual({ required: false });
    saveOrgAutomationRules({ ptwRequiresProjectRams: true });
    expect(projectRamsCheckForPermit("p1", false)).toEqual({ required: true, hasRams: false });
    expect(projectRamsCheckForPermit("", false)).toEqual({ required: false });
  });

  it("defaults match expected keys", () => {
    expect(DEFAULT_ORG_AUTOMATION_RULES.requireProjectLink).toBe(true);
    expect(DEFAULT_ORG_AUTOMATION_RULES.staleSurveyReminderDays).toBe(14);
  });
});
