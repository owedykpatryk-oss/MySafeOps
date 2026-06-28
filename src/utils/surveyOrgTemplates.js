/**
 * Organisation overrides for survey type scope / method / equipment defaults.
 */

import { SURVEY_TYPES } from "../modules/surveyReport/surveyReportConstants";
import { SURVEY_TYPE_TEMPLATES } from "../modules/surveyReport/surveyTypeTemplates";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

function normalizeTemplateFields(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const key of ["scope", "methodology", "equipmentUsed"]) {
    if (typeof raw[key] === "string" && raw[key].trim()) out[key] = raw[key].trim();
  }
  return Object.keys(out).length ? out : null;
}

export function getOrgSurveyTypeOverrides() {
  const raw = loadOrgSettingsRaw().surveyTypeTemplates;
  return raw && typeof raw === "object" ? raw : {};
}

/** @returns {{ scope?: string, methodology?: string, equipmentUsed?: string } | null} */
export function getSurveyTypeTemplate(surveyType) {
  const key = String(surveyType || "").trim();
  if (!key) return null;
  const builtIn = SURVEY_TYPE_TEMPLATES[key] || null;
  const org = normalizeTemplateFields(getOrgSurveyTypeOverrides()[key]);
  if (!builtIn && !org) return null;
  return {
    scope: org?.scope ?? builtIn?.scope ?? "",
    methodology: org?.methodology ?? builtIn?.methodology ?? "",
    equipmentUsed: org?.equipmentUsed ?? builtIn?.equipmentUsed ?? "",
  };
}

export function listSurveyTemplatesForEditor() {
  const overrides = getOrgSurveyTypeOverrides();
  return SURVEY_TYPES.map(({ key, label }) => {
    const builtIn = SURVEY_TYPE_TEMPLATES[key] || {};
    const org = normalizeTemplateFields(overrides[key]);
    const merged = getSurveyTypeTemplate(key) || {};
    return {
      key,
      label,
      builtIn,
      override: org,
      effective: merged,
      hasOverride: Boolean(org),
    };
  });
}

export function saveSurveyTypeTemplateOverride(surveyType, fields) {
  const key = String(surveyType || "").trim();
  if (!key) return getOrgSurveyTypeOverrides();
  const settings = loadOrgSettingsRaw();
  const map = { ...(settings.surveyTypeTemplates || {}) };
  const normalized = normalizeTemplateFields(fields);
  if (normalized) map[key] = normalized;
  else delete map[key];
  saveOrgSettingsRaw({ ...settings, surveyTypeTemplates: map });
  return map;
}

export function resetSurveyTypeTemplateOverride(surveyType) {
  return saveSurveyTypeTemplateOverride(surveyType, null);
}
