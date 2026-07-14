/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeOrgAutomationRules,
  isAutomationEnabled,
  projectRamsCheckForPermit,
  saveOrgAutomationRules,
  applyAutomationPreset,
  summarizeAutomationRules,
  staleSurveyReminderDays,
  DEFAULT_ORG_AUTOMATION_RULES,
  AUTOMATION_PRESETS,
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
    expect(rules.certExpiryReminder).toBe(true);
  });

  it("isAutomationEnabled reads persisted rules", () => {
    saveOrgAutomationRules({ ptwRequiresProjectRams: false });
    expect(isAutomationEnabled("ptwRequiresProjectRams")).toBe(false);
    expect(isAutomationEnabled("surveyFinalGate")).toBe(true);
    expect(isAutomationEnabled("certExpiryReminder")).toBe(true);
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
    expect(DEFAULT_ORG_AUTOMATION_RULES.weeklyDigest).toBe(true);
  });

  it("applyAutomationPreset applies relaxed gates", () => {
    applyAutomationPreset("relaxed");
    expect(isAutomationEnabled("surveyFinalGate")).toBe(false);
    expect(isAutomationEnabled("dailyBriefingReminder")).toBe(true);
    expect(staleSurveyReminderDays()).toBe(21);
  });

  it("summarizeAutomationRules counts active rules", () => {
    const summary = summarizeAutomationRules({
      ...DEFAULT_ORG_AUTOMATION_RULES,
      surveyFinalGate: false,
      certExpiryReminder: false,
    });
    expect(summary.gatesOn).toBe(4);
    expect(summary.remindersOn).toBe(10);
  });

  it("presets are defined for all profiles", () => {
    expect(Object.keys(AUTOMATION_PRESETS)).toEqual(["strict", "standard", "relaxed", "remindersOnly", "surveyFirm"]);
  });

  it("surveyFirm preset keeps survey gates strict", () => {
    applyAutomationPreset("surveyFirm");
    expect(isAutomationEnabled("surveyFinalGate")).toBe(true);
    expect(isAutomationEnabled("surveyExportGate")).toBe(true);
    expect(isAutomationEnabled("ptwRequiresProjectRams")).toBe(true);
    expect(staleSurveyReminderDays()).toBe(7);
  });
});
