/** Collect / restore MySafeOps localStorage keys for org + global org settings */

import { getOrgId } from "./orgStorage";
import { GEOCODE_CACHE_STORAGE_KEY } from "./geocode";

const GLOBAL_KEYS = ["mysafeops_org_settings", "mysafeops_orgId", "mysafeops_notif_prefs", "mysafeops_notif_seen"];

/**
 * Backs up every key that ends with `_${orgId}` (e.g. rams_builder_docs_default, mysafeops_site_presence_default)
 * plus global keys above. Geocode cache is global and optional (`includeGeocodeCache`).
 */
/**
 * Lightweight checks before import or cloud round-trip.
 * @param {unknown} bundle
 * @returns {{ ok: true, keyCount: number } | { ok: false, message: string }}
 */
export function validateBackupBundle(bundle) {
  if (!bundle || typeof bundle !== "object") return { ok: false, message: "Backup must be a JSON object." };
  if (bundle.version != null && bundle.version !== 1) {
    return { ok: false, message: `Unsupported backup version (${bundle.version}). Expected 1.` };
  }
  if (!bundle.keys || typeof bundle.keys !== "object" || Array.isArray(bundle.keys)) {
    return { ok: false, message: 'Invalid backup: missing "keys" object.' };
  }
  const keyCount = Object.keys(bundle.keys).length;
  if (keyCount === 0) return { ok: false, message: "Backup contains no keys." };
  return { ok: true, keyCount };
}

export function collectBackupBundle({ includeGeocodeCache = false } = {}) {
  const orgId = getOrgId();
  const suffix = `_${orgId}`;
  const data = { version: 1, exportedAt: new Date().toISOString(), orgId, keys: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (GLOBAL_KEYS.includes(k) || k.endsWith(suffix)) {
      data.keys[k] = localStorage.getItem(k);
    }
  }
  if (includeGeocodeCache) {
    const geo = localStorage.getItem(GEOCODE_CACHE_STORAGE_KEY);
    if (geo != null) data.keys[GEOCODE_CACHE_STORAGE_KEY] = geo;
  }
  return data;
}

export function restoreBackupBundle(bundle, { merge = false } = {}) {
  if (!bundle?.keys || typeof bundle.keys !== "object") throw new Error("Invalid backup file");
  if (!merge && !confirm("Replace all matching keys on this device? This cannot be undone.")) {
    return { applied: 0, skipped: true };
  }
  if (merge && !confirm("Merge keys from backup? Existing values may be overwritten where keys match.")) {
    return { applied: 0, skipped: true };
  }
  let applied = 0;
  for (const [k, v] of Object.entries(bundle.keys)) {
    if (typeof v === "string") {
      localStorage.setItem(k, v);
      applied++;
    }
  }
  return { applied, skipped: false };
}
