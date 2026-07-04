/**
 * Custom workspace profile storage, editing, and cloud sync helpers.
 */
import { loadOrgScoped, saveOrgScoped } from "./orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { INDUSTRY_PACKS } from "./orgIndustryPacks";
import { MORE_TABS } from "../navigation/appModules";
import { getRamsStarterLabel, isSurveyRamsStarterKey, isValidTradeRamsStarterKey } from "./ramsIndustryStarters";

const LEGACY_SCOPED_KEY = "custom_workspace_profiles";

/** @typedef {{
 *   id: string,
 *   custom: true,
 *   label: string,
 *   hint: string,
 *   basedOn?: string,
 *   hidePreset?: string | null,
 *   hiddenModules?: string[],
 *   showModules?: string[],
 *   industrySectors?: string[] | null,
 *   ramsStarterKey?: string | null,
 *   surveyWorkflow?: boolean,
 *   createdAt: string,
 *   updatedAt: string,
 * }} CustomWorkspaceProfile */

/** Module ids available in profile editor (More grid, excl. settings/superadmin). */
export const PROFILE_EDITABLE_MODULE_IDS = MORE_TABS.map((t) => t.id).filter(
  (id) => !["settings", "superadmin", "help"].includes(id)
);

function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object" || !raw.custom || typeof raw.id !== "string" || !raw.id.startsWith("custom_")) {
    return null;
  }
  return /** @type {CustomWorkspaceProfile} */ (raw);
}

/** @param {CustomWorkspaceProfile[]} profiles */
function persistCustomWorkspaceProfiles(profiles) {
  const list = profiles.map((p) => ({ ...p, custom: true }));
  saveOrgScoped(LEGACY_SCOPED_KEY, list);
  const raw = loadOrgSettingsRaw();
  saveOrgSettingsRaw({ ...raw, customWorkspaceProfiles: list });
}

/** Merge cloud-pulled profiles into local org settings (org-private). */
export function mergeCustomProfilesFromCloudSettings(cloudSettings) {
  if (!cloudSettings || !Array.isArray(cloudSettings.customWorkspaceProfiles)) return false;
  const incoming = cloudSettings.customWorkspaceProfiles.map(normalizeProfile).filter(Boolean);
  if (!incoming.length) return false;
  persistCustomWorkspaceProfiles(incoming);
  return true;
}

/** @returns {CustomWorkspaceProfile[]} */
export function loadCustomWorkspaceProfiles() {
  const raw = loadOrgSettingsRaw();
  if (Array.isArray(raw.customWorkspaceProfiles) && raw.customWorkspaceProfiles.length) {
    return raw.customWorkspaceProfiles.map(normalizeProfile).filter(Boolean);
  }
  const legacy = loadOrgScoped(LEGACY_SCOPED_KEY, []);
  if (Array.isArray(legacy) && legacy.length) {
    const migrated = legacy.map(normalizeProfile).filter(Boolean);
    if (migrated.length) persistCustomWorkspaceProfiles(migrated);
    return migrated;
  }
  return [];
}

/** @param {unknown} id */
export function isCustomWorkspacePackId(id) {
  return typeof id === "string" && id.startsWith("custom_");
}

/** @param {string} id @returns {CustomWorkspaceProfile | null} */
export function getCustomWorkspaceProfile(id) {
  if (!isCustomWorkspacePackId(id)) return null;
  return loadCustomWorkspaceProfiles().find((p) => p.id === id) || null;
}

/**
 * Resolve any pack id (built-in or custom) to a pack config object.
 * @param {string} packKey
 */
export function resolveWorkspacePack(packKey) {
  if (Object.prototype.hasOwnProperty.call(INDUSTRY_PACKS, packKey)) {
    return INDUSTRY_PACKS[packKey];
  }
  return getCustomWorkspaceProfile(packKey);
}

/** Built-in + this org's custom profiles only (never cross-org). */
export function listWorkspaceProfilesForOrg() {
  const builtIn = Object.entries(INDUSTRY_PACKS).map(([id, pack]) => ({ id, ...pack, custom: false }));
  const custom = loadCustomWorkspaceProfiles().map((p) => ({ id: p.id, ...p }));
  return [...builtIn, ...custom];
}

/** Effective pack id for seeds, playbooks and readiness (custom → basedOn or survey). */
export function resolveProfileBehaviorPackId(packId) {
  if (!isCustomWorkspacePackId(packId)) return packId;
  const custom = getCustomWorkspaceProfile(packId);
  if (!custom) return "generalContractor";
  if (custom.surveyWorkflow) return "surveyingGeodesy";
  if (custom.basedOn && INDUSTRY_PACKS[custom.basedOn]) return custom.basedOn;
  return "generalContractor";
}

/** @param {CustomWorkspaceProfile} profile @param {string[]} visibleModuleIds */
export function moduleListsFromVisible(profile, visibleModuleIds) {
  const visible = new Set(visibleModuleIds);
  const base = INDUSTRY_PACKS[profile.basedOn || "generalContractor"] || INDUSTRY_PACKS.generalContractor;
  const baseShow = new Set(base.showModules || []);
  const baseHidden = new Set(base.hiddenModules || []);
  const showModules = [];
  const hiddenModules = [];
  for (const id of PROFILE_EDITABLE_MODULE_IDS) {
    const on = visible.has(id);
    if (on && (baseHidden.has(id) || !baseShow.has(id))) showModules.push(id);
    if (!on && (baseShow.has(id) || !baseHidden.has(id))) hiddenModules.push(id);
  }
  return { showModules, hiddenModules };
}

/** @param {CustomWorkspaceProfile} profile */
export function visibleModulesForProfile(profile) {
  const base = INDUSTRY_PACKS[profile.basedOn || "generalContractor"] || INDUSTRY_PACKS.generalContractor;
  const hidden = new Set([...(base.hiddenModules || []), ...(profile.hiddenModules || [])]);
  const show = new Set([...(base.showModules || []), ...(profile.showModules || [])]);
  return PROFILE_EDITABLE_MODULE_IDS.filter((id) => {
    if (show.has(id)) return true;
    if (hidden.has(id)) return false;
    return !base.hiddenModules?.includes(id);
  });
}

function newCustomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `custom_${Date.now().toString(36)}`;
}

function buildProfileFromInput(input, id, createdAt) {
  const label = String(input.label || "").trim();
  if (!label) throw new Error("Profile name is required");
  const baseKey = input.basedOn && INDUSTRY_PACKS[input.basedOn] ? input.basedOn : "generalContractor";
  const base = INDUSTRY_PACKS[baseKey];
  const now = new Date().toISOString();
  const draft = {
    id,
    custom: true,
    label,
    hint: String(input.hint || "").trim() || `Custom profile based on ${base.label}.`,
    basedOn: baseKey,
    hidePreset: base.hidePreset ?? null,
    hiddenModules: Array.isArray(input.hiddenModules) ? [...input.hiddenModules] : [...(base.hiddenModules || [])],
    showModules: Array.isArray(input.showModules) ? [...input.showModules] : [...(base.showModules || [])],
    industrySectors: Array.isArray(input.industrySectors) ? [...input.industrySectors] : base.industrySectors ? [...base.industrySectors] : ["construction"],
    ramsStarterKey: input.ramsStarterKey !== undefined ? input.ramsStarterKey : (base.ramsStarterKey ?? "general"),
    surveyWorkflow: Boolean(input.surveyWorkflow ?? base.surveyWorkflow),
    createdAt: createdAt || now,
    updatedAt: now,
  };
  if (Array.isArray(input.visibleModuleIds)) {
    const { showModules, hiddenModules } = moduleListsFromVisible(draft, input.visibleModuleIds);
    draft.showModules = showModules;
    draft.hiddenModules = hiddenModules;
  }
  return draft;
}

/**
 * @param {{ label: string, hint?: string, basedOn?: string, showModules?: string[], hiddenModules?: string[], visibleModuleIds?: string[], industrySectors?: string[], ramsStarterKey?: string | null, surveyWorkflow?: boolean }} input
 */
export function createCustomWorkspaceProfile(input) {
  const profile = buildProfileFromInput(input, newCustomId(), null);
  persistCustomWorkspaceProfiles([...loadCustomWorkspaceProfiles(), profile]);
  return profile;
}

/**
 * @param {string} id
 * @param {Partial<CustomWorkspaceProfile> & { visibleModuleIds?: string[] }} patch
 */
export function updateCustomWorkspaceProfile(id, patch) {
  const profiles = loadCustomWorkspaceProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Profile not found");
  const merged = buildProfileFromInput(
    { ...profiles[idx], ...patch, basedOn: patch.basedOn ?? profiles[idx].basedOn },
    id,
    profiles[idx].createdAt
  );
  profiles[idx] = merged;
  persistCustomWorkspaceProfiles(profiles);
  return merged;
}

/** @param {string} id */
export function duplicateCustomWorkspaceProfile(id) {
  const src = getCustomWorkspaceProfile(id);
  if (!src) throw new Error("Profile not found");
  return createCustomWorkspaceProfile({
    label: `${src.label} (copy)`,
    hint: src.hint,
    basedOn: src.basedOn,
    showModules: [...(src.showModules || [])],
    hiddenModules: [...(src.hiddenModules || [])],
    industrySectors: src.industrySectors ? [...src.industrySectors] : undefined,
    ramsStarterKey: src.ramsStarterKey,
    surveyWorkflow: src.surveyWorkflow,
  });
}

/** @param {string} id */
export function deleteCustomWorkspaceProfile(id) {
  if (!isCustomWorkspacePackId(id)) return false;
  const profiles = loadCustomWorkspaceProfiles();
  const next = profiles.filter((p) => p.id !== id);
  if (next.length === profiles.length) return false;
  persistCustomWorkspaceProfiles(next);
  return true;
}

/** RAMS starter options for profile editor. */
export function ramsStarterOptionsForEditor() {
  const tradeKeys = [
    "general",
    "electrical",
    "refurb_build",
    "groundworks",
    "demolition",
    "geospatial_intelligence",
    "utility_mapping_survey",
    "healthcare_fm",
  ];
  return tradeKeys.map((key) => ({
    key,
    label: isSurveyRamsStarterKey(key) || key === "geospatial_intelligence" ? getRamsStarterLabel(key) : getRamsStarterLabel(key),
  })).filter((o) => isSurveyRamsStarterKey(o.key) || isValidTradeRamsStarterKey(o.key) || o.key === "geospatial_intelligence");
}
