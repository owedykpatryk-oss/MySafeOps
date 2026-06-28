/**
 * Organisation overrides for method statement step sequence templates.
 */

import { MS_STEP_TEMPLATES, MS_TEMPLATE_DEFS } from "../modules/msStepTemplates";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

function normalizeStepsOverride(raw) {
  if (!Array.isArray(raw)) return null;
  const steps = raw.map((s) => String(s || "").trim()).filter(Boolean);
  return steps.length ? steps : null;
}

export function getOrgMsStepOverrides() {
  const raw = loadOrgSettingsRaw().msStepTemplates;
  return raw && typeof raw === "object" ? raw : {};
}

/** @returns {string[]} */
export function getMsStepTemplate(templateKey) {
  const key = String(templateKey || "").trim();
  if (!key) return [];
  const builtIn = MS_STEP_TEMPLATES[key] || [];
  const org = normalizeStepsOverride(getOrgMsStepOverrides()[key]);
  return org || builtIn;
}

export function listMsTemplatesForEditor() {
  const overrides = getOrgMsStepOverrides();
  return MS_TEMPLATE_DEFS.map(({ key, label }) => {
    const builtIn = MS_STEP_TEMPLATES[key] || [];
    const org = normalizeStepsOverride(overrides[key]);
    const effective = getMsStepTemplate(key);
    return {
      key,
      label,
      builtIn,
      override: org,
      effective,
      hasOverride: Boolean(org),
    };
  });
}

export function saveMsStepTemplateOverride(templateKey, stepsText) {
  const key = String(templateKey || "").trim();
  if (!key) return getOrgMsStepOverrides();
  const settings = loadOrgSettingsRaw();
  const map = { ...(settings.msStepTemplates || {}) };
  const lines = String(stepsText ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length) map[key] = lines;
  else delete map[key];
  saveOrgSettingsRaw({ ...settings, msStepTemplates: map });
  return map;
}

export function resetMsStepTemplateOverride(templateKey) {
  const key = String(templateKey || "").trim();
  if (!key) return getOrgMsStepOverrides();
  const settings = loadOrgSettingsRaw();
  const map = { ...(settings.msStepTemplates || {}) };
  delete map[key];
  saveOrgSettingsRaw({ ...settings, msStepTemplates: map });
  return map;
}
