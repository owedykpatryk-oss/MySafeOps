import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";
import { PERMIT_TYPES } from "./permitTypes";
import { loadOrgSettingsRaw } from "../../utils/orgSettingsStorage";
import { getAppliedIndustryPackId } from "../../utils/orgIndustryPacks";
import { PACK_DEFAULT_PERMIT_TYPES, normalizeEnabledPermitTypeIds } from "./permitPackDefaults";

export const PERMIT_DEFAULT_SAVED_VIEW_KEY = "permit_default_saved_view_id_v1";

export { PACK_DEFAULT_PERMIT_TYPES, allPermitTypeIds, normalizeEnabledPermitTypeIds } from "./permitPackDefaults";

export function getEnabledPermitTypeIds(org = loadOrgSettingsRaw()) {
  const enabled = normalizeEnabledPermitTypeIds(org?.enabledPermitTypes);
  if (enabled.length) return enabled;
  const packId = org?.industryPackId || getAppliedIndustryPackId();
  const fromPack = PACK_DEFAULT_PERMIT_TYPES[packId];
  if (Array.isArray(fromPack) && fromPack.length) return normalizeEnabledPermitTypeIds(fromPack);
  return [];
}

export function filterPermitTypesForOrg(allTypes, enabledIds) {
  const src = allTypes && typeof allTypes === "object" ? allTypes : PERMIT_TYPES;
  const ids = normalizeEnabledPermitTypeIds(enabledIds);
  if (!ids.length) return src;
  const out = {};
  ids.forEach((id) => {
    if (src[id]) out[id] = src[id];
  });
  if (!out.general && src.general) out.general = src.general;
  return Object.keys(out).length ? out : src;
}

export function isPermitSupervisorMode(org = loadOrgSettingsRaw()) {
  return org?.permitSupervisorMode === true;
}

export function normalizePermitQuickFavorites(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  return {
    types: normalizeEnabledPermitTypeIds(base.types).slice(0, 5),
    issuers: (Array.isArray(base.issuers) ? base.issuers : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 5),
    locations: (Array.isArray(base.locations) ? base.locations : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 8),
  };
}

export function getPermitQuickFavorites(org = loadOrgSettingsRaw()) {
  return normalizePermitQuickFavorites(org?.permitQuickFavorites);
}

export function getDefaultPermitSavedViewId(org = loadOrgSettingsRaw()) {
  return String(org?.permitDefaultSavedViewId || load(PERMIT_DEFAULT_SAVED_VIEW_KEY, "") || "").trim();
}

export function setDefaultPermitSavedViewId(viewId, orgUpdater) {
  const id = String(viewId || "").trim();
  save(PERMIT_DEFAULT_SAVED_VIEW_KEY, id);
  if (typeof orgUpdater === "function") orgUpdater(id);
}

export function favoriteTypesForIssue(issueTypes, favorites, limit = 5) {
  const ordered = [];
  (favorites?.types || []).forEach((t) => {
    if (issueTypes[t] && !ordered.includes(t)) ordered.push(t);
  });
  Object.keys(issueTypes).forEach((t) => {
    if (ordered.length >= limit) return;
    if (!ordered.includes(t)) ordered.push(t);
  });
  return ordered.slice(0, limit);
}
