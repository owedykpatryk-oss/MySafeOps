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
    impact: "block",
    default: true,
  },
  {
    id: "surveyFinalGate",
    label: "Survey finalisation gate",
    hint: "Block marking a survey final until QA, photos, equipment and sign-off are complete.",
    impact: "block",
    default: true,
  },
  {
    id: "surveyExportGate",
    label: "Survey export pack gate",
    hint: "Block export pack until the report is final and PAS128 fields are complete where required.",
    impact: "block",
    default: true,
  },
  {
    id: "ptwRequiresProjectRams",
    label: "PTW requires site RAMS",
    hint: "Block permit approval and activation when the linked project has no RAMS document.",
    impact: "block",
    default: true,
  },
  {
    id: "autoApplyPlaybookOnCreate",
    label: "Auto-apply playbook on new project",
    hint: "When a playbook is selected in the project wizard, create RAMS, survey, PTW and MS drafts on save.",
    impact: "create",
    default: true,
  },
];

export const REMINDER_RULE_DEFS = [
  {
    id: "dailyBriefingReminder",
    label: "Daily briefing reminder",
    hint: "Notify on weekdays from 10:00 when no briefing has been recorded today.",
    impact: "notify",
    default: true,
  },
  {
    id: "monthlyReportReminder",
    label: "Monthly HSE report reminder",
    hint: "Notify when no monthly report exists for the current calendar month (from day 5).",
    impact: "notify",
    default: true,
  },
  {
    id: "certExpiryReminder",
    label: "Certificate expiry reminders",
    hint: "Alert when worker CSCS, IPAF and other certs approach expiry (30, 14, 7 and 1 day).",
    impact: "notify",
    default: true,
  },
  {
    id: "permitExpiryReminder",
    label: "Permit expiry reminders",
    hint: "Alert before active permits expire — same-day uses hours for clarity.",
    impact: "notify",
    default: true,
  },
  {
    id: "permitBriefingReminder",
    label: "Permit briefing pending alerts",
    hint: "High-risk active permits (hot work, confined space, LOTO…) without briefing confirmation.",
    impact: "notify",
    default: true,
  },
  {
    id: "permitRamsLinkReminder",
    label: "Permit missing RAMS alerts",
    hint: "Active permits with no linked RAMS document on the project.",
    impact: "notify",
    default: true,
  },
  {
    id: "ramsReviewReminder",
    label: "RAMS review due reminders",
    hint: "Notify 14 days before a RAMS document review date.",
    impact: "notify",
    default: true,
  },
  {
    id: "equipInspectReminder",
    label: "Equipment inspection reminders",
    hint: "Plant and equipment inspection due dates (14 and 7 day window).",
    impact: "notify",
    default: true,
  },
  {
    id: "weeklyDigest",
    label: "Weekly workspace digest",
    hint: "Monday summary — active projects, PTW count and survey pipeline.",
    impact: "notify",
    default: true,
  },
];

export const DEFAULT_ORG_AUTOMATION_RULES = {
  requireProjectLink: true,
  surveyFinalGate: true,
  surveyExportGate: true,
  ptwRequiresProjectRams: true,
  autoApplyPlaybookOnCreate: true,
  dailyBriefingReminder: true,
  monthlyReportReminder: true,
  certExpiryReminder: true,
  permitExpiryReminder: true,
  permitBriefingReminder: true,
  permitRamsLinkReminder: true,
  ramsReviewReminder: true,
  equipInspectReminder: true,
  weeklyDigest: true,
  /** 0 = off; otherwise remind when draft surveys are idle this many days */
  staleSurveyReminderDays: 14,
};

/** @type {Record<string, { label: string, hint: string, rules: Partial<OrgAutomationRules> }>} */
export const AUTOMATION_PRESETS = {
  strict: {
    label: "Strict HSE",
    hint: "All gates on · tighter stale-survey window (7 days) · every reminder active.",
    rules: { ...DEFAULT_ORG_AUTOMATION_RULES, staleSurveyReminderDays: 7 },
  },
  standard: {
    label: "Standard",
    hint: "Balanced defaults — recommended for most contractors.",
    rules: { ...DEFAULT_ORG_AUTOMATION_RULES },
  },
  relaxed: {
    label: "Relaxed",
    hint: "No save blocks — reminders stay on so nothing slips through quietly.",
    rules: {
      ...DEFAULT_ORG_AUTOMATION_RULES,
      requireProjectLink: false,
      surveyFinalGate: false,
      surveyExportGate: false,
      ptwRequiresProjectRams: false,
      staleSurveyReminderDays: 21,
    },
  },
  remindersOnly: {
    label: "Reminders only",
    hint: "Turn off hard gates and playbook auto-create — keep nudges only.",
    rules: {
      ...DEFAULT_ORG_AUTOMATION_RULES,
      requireProjectLink: false,
      surveyFinalGate: false,
      surveyExportGate: false,
      ptwRequiresProjectRams: false,
      autoApplyPlaybookOnCreate: false,
    },
  },
  surveyFirm: {
    label: "Survey firm",
    hint: "Strict survey QA and export gates · PTW requires RAMS · playbook auto-create on.",
    rules: {
      ...DEFAULT_ORG_AUTOMATION_RULES,
      surveyFinalGate: true,
      surveyExportGate: true,
      ptwRequiresProjectRams: true,
      autoApplyPlaybookOnCreate: true,
      staleSurveyReminderDays: 7,
    },
  },
};

const RULE_IDS = new Set([...AUTOMATION_RULE_DEFS, ...REMINDER_RULE_DEFS].map((d) => d.id));

const IMPACT_LABELS = { block: "Blocks save", notify: "Notification", create: "Auto-create" };

export function getAutomationImpactLabel(impact) {
  return IMPACT_LABELS[impact] || impact;
}

export function normalizeOrgAutomationRules(raw) {
  const base = { ...DEFAULT_ORG_AUTOMATION_RULES };
  if (!raw || typeof raw !== "object") return base;
  for (const def of [...AUTOMATION_RULE_DEFS, ...REMINDER_RULE_DEFS]) {
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

export function applyAutomationPreset(presetId) {
  const preset = AUTOMATION_PRESETS[presetId];
  if (!preset) return getOrgAutomationRules();
  return saveOrgAutomationRules(preset.rules, { merge: false });
}

/** @param {OrgAutomationRules} rules */
export function summarizeAutomationRules(rules = getOrgAutomationRules()) {
  const gatesOn = AUTOMATION_RULE_DEFS.filter((d) => rules[d.id] !== false).length;
  const remindersOn = REMINDER_RULE_DEFS.filter((d) => rules[d.id] !== false).length;
  const staleDays = rules.staleSurveyReminderDays || 0;
  return {
    gatesOn,
    gatesTotal: AUTOMATION_RULE_DEFS.length,
    remindersOn,
    remindersTotal: REMINDER_RULE_DEFS.length,
    staleSurveyDays: staleDays,
    staleSurveyActive: staleDays > 0,
  };
}

/** @param {string} ruleId */
export function isAutomationEnabled(ruleId) {
  if (!RULE_IDS.has(ruleId)) return false;
  return getOrgAutomationRules()[ruleId] !== false;
}

/** Maps automation reminder ids to notification preference keys in pushNotifications. */
export const REMINDER_TO_NOTIF_PREF = {
  certExpiryReminder: "cert_expiry",
  permitExpiryReminder: "permit_expiry",
  permitBriefingReminder: "permit_briefing",
  permitRamsLinkReminder: "permit_rams_link",
  ramsReviewReminder: "rams_review",
  equipInspectReminder: "equip_inspect",
  weeklyDigest: "weekly_digest",
  dailyBriefingReminder: "daily_briefing",
  monthlyReportReminder: "monthly_report",
};

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
