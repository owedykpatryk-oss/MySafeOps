/**
 * Organisation automation rules — deterministic gates and reminders (no AI).
 * Stored in org settings under `automationRules`.
 */

import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

/** @typedef {typeof DEFAULT_ORG_AUTOMATION_RULES} OrgAutomationRules */

export const AUTOMATION_RULE_DEFS = [
  {
    id: "requireProjectLink",
    label: "Require project on save",
    hint: "Surveys, geo-photos and snags must be linked to a project before saving.",
    default: true,
  },
  {
    id: "surveyFinalGate",
    label: "Survey finalisation gate",
    hint: "Block marking a survey final until QA, photos, equipment and sign-off are complete.",
    default: true,
  },
  {
    id: "surveyExportGate",
    label: "Survey export pack gate",
    hint: "Block export pack until the report is final and PAS128 fields are complete where required.",
    default: true,
  },
  {
    id: "ptwRequiresProjectRams",
    label: "PTW requires site RAMS",
    hint: "Block permit approval and activation when the linked project has no RAMS document.",
    default: true,
  },
  {
    id: "autoApplyPlaybookOnCreate",
    label: "Auto-apply playbook on new project",
    hint: "When a playbook is selected in the project wizard, create RAMS, survey, PTW and MS drafts on save.",
    default: true,
  },
];

export const DEFAULT_ORG_AUTOMATION_RULES = {
  requireProjectLink: true,
  surveyFinalGate: true,
  surveyExportGate: true,
  ptwRequiresProjectRams: true,
  autoApplyPlaybookOnCreate: true,
  /** 0 = off; otherwise remind when draft surveys are idle this many days */
  staleSurveyReminderDays: 14,
};

const RULE_IDS = new Set(AUTOMATION_RULE_DEFS.map((d) => d.id));

export function normalizeOrgAutomationRules(raw) {
  const base = { ...DEFAULT_ORG_AUTOMATION_RULES };
  if (!raw || typeof raw !== "object") return base;
  for (const def of AUTOMATION_RULE_DEFS) {
    if (typeof raw[def.id] === "boolean") base[def.id] = raw[def.id];
  }
  const days = Number(raw.staleSurveyReminderDays);
  if (Number.isFinite(days) && days >= 0 && days <= 365) {
    base.staleSurveyReminderDays = Math.floor(days);
  }
  return base;
}

export function getOrgAutomationRules() {
  const settings = loadOrgSettingsRaw();
  return normalizeOrgAutomationRules(settings.automationRules);
}

export function saveOrgAutomationRules(partial, { merge = true } = {}) {
  const settings = loadOrgSettingsRaw();
  const nextRules = merge
    ? normalizeOrgAutomationRules({ ...settings.automationRules, ...partial })
    : normalizeOrgAutomationRules(partial);
  saveOrgSettingsRaw({ ...settings, automationRules: nextRules });
  return nextRules;
}

/** @param {string} ruleId */
export function isAutomationEnabled(ruleId) {
  if (!RULE_IDS.has(ruleId)) return false;
  return getOrgAutomationRules()[ruleId] !== false;
}

/** @param {string} projectId @param {boolean} hasRams */
export function projectRamsCheckForPermit(projectId, hasRams) {
  if (!isAutomationEnabled("ptwRequiresProjectRams")) return { required: false };
  const pid = String(projectId || "").trim();
  if (!pid) return { required: false };
  return { required: true, hasRams: Boolean(hasRams) };
}

export function staleSurveyReminderDays() {
  return getOrgAutomationRules().staleSurveyReminderDays || 0;
}
