/**
 * Organisation overrides for survey type defaults (catalog + extended prebuilds).
 */

import { SURVEY_TYPES } from "../modules/surveyReport/surveyReportConstants";
import {
  SURVEY_TYPE_TEMPLATES,
  getSurveyCatalogEntry,
  isSurveySimpleMode,
} from "./surveyContentCatalog";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

export { isSurveySimpleMode };

const TEXT_KEYS = ["scope", "methodology", "equipmentUsed", "recordsBoilerplate", "executiveSummaryTemplate", "recommendationsTemplate"];
const ARRAY_KEYS = ["defaultLimitationKeys", "defaultDeliverables"];

function normalizeTemplateFields(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  TEXT_KEYS.forEach((key) => {
    if (typeof raw[key] === "string" && raw[key].trim()) out[key] = raw[key].trim();
  });
  ARRAY_KEYS.forEach((key) => {
    if (Array.isArray(raw[key]) && raw[key].length) out[key] = raw[key];
  });
  return Object.keys(out).length ? out : null;
}

export function getOrgSurveyTypeOverrides() {
  const raw = loadOrgSettingsRaw().surveyTypeTemplates;
  return raw && typeof raw === "object" ? raw : {};
}

function mergeCatalogWithOverride(key, org) {
  const builtIn = getSurveyCatalogEntry(key) || SURVEY_TYPE_TEMPLATES[key] || null;
  if (!builtIn && !org) return null;
  const merged = {
    scope: org?.scope ?? builtIn?.scope ?? "",
    methodology: org?.methodology ?? builtIn?.methodology ?? "",
    equipmentUsed: org?.equipmentUsed ?? builtIn?.equipmentUsed ?? "",
    recordsBoilerplate: org?.recordsBoilerplate ?? builtIn?.recordsBoilerplate ?? "",
    executiveSummaryTemplate: org?.executiveSummaryTemplate ?? builtIn?.executiveSummaryTemplate ?? "",
    recommendationsTemplate: org?.recommendationsTemplate ?? builtIn?.recommendationsTemplate ?? "",
    defaultLimitationKeys: org?.defaultLimitationKeys ?? builtIn?.defaultLimitationKeys ?? [],
    defaultDeliverables: org?.defaultDeliverables ?? builtIn?.defaultDeliverables ?? [],
    defaultPas128Ql: builtIn?.defaultPas128Ql ?? "",
  };
  return merged;
}

/** @returns {ReturnType<typeof mergeCatalogWithOverride> | null} */
export function getSurveyTypeTemplate(surveyType) {
  const key = String(surveyType || "").trim();
  if (!key) return null;
  const org = normalizeTemplateFields(getOrgSurveyTypeOverrides()[key]);
  return mergeCatalogWithOverride(key, org);
}

export function listSurveyTemplatesForEditor() {
  const overrides = getOrgSurveyTypeOverrides();
  return SURVEY_TYPES.map(({ key, label }) => {
    const builtIn = getSurveyCatalogEntry(key) || {};
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

export function setSurveySimpleMode(enabled) {
  const settings = loadOrgSettingsRaw();
  saveOrgSettingsRaw({ ...settings, surveySimpleMode: enabled !== false });
}
