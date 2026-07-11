/**
 * Canonical org-scoped key for RAMS hazard quick packs (RAMS Builder).
 * Migrates legacy `rams_quick_packs` on first read.
 */
import { loadOrgScoped as load, saveOrgScoped as save, getOrgId } from "./orgStorage";
import { filterQuickPacksForOrg } from "../modules/rams/orgExclusiveQuickPacks";

export const RAMS_HAZARD_PACKS_KEY = "rams_hazard_quick_packs";
export const RAMS_HAZARD_PACKS_LEGACY_KEY = "rams_quick_packs";

/** @param {unknown[]} [fallback] */
export function loadRamsHazardPacks(fallback = []) {
  const current = load(RAMS_HAZARD_PACKS_KEY, null);
  if (Array.isArray(current) && current.length > 0) {
    return filterQuickPacksForOrg(current, getOrgId());
  }
  const legacy = load(RAMS_HAZARD_PACKS_LEGACY_KEY, []);
  if (Array.isArray(legacy) && legacy.length > 0) {
    const filtered = filterQuickPacksForOrg(legacy, getOrgId());
    save(RAMS_HAZARD_PACKS_KEY, filtered);
    return filtered;
  }
  const base = Array.isArray(current) ? current : fallback;
  return filterQuickPacksForOrg(base, getOrgId());
}

/** @param {unknown[]} packs */
export function saveRamsHazardPacks(packs) {
  save(RAMS_HAZARD_PACKS_KEY, packs);
}
