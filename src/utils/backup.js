/** Organisation backups include the primary workspace and every stored country workspace. */
import { getOrgId } from "./orgStorage";
import { GEOCODE_CACHE_STORAGE_KEY } from "./geocode";
import { LEGACY_GLOBAL_KEYS, backupKeyScope, validateBackupBundle } from "./backupValidation.js";
export { backupKeyScope, validateBackupBundle } from "./backupValidation.js";

export function collectBackupBundle({ includeGeocodeCache = false } = {}) {
  const orgId = getOrgId();
  const data = { version: 2, exportedAt: new Date().toISOString(), orgId, scopes: {}, keys: {}, skippedUnknownKeyCount: 0 };
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const scope = backupKeyScope(key, orgId);
    if (!scope) {
      if (key?.split("__country_")[0].endsWith(`_${orgId}`)) data.skippedUnknownKeyCount++;
      continue;
    }
    data.keys[key] = localStorage.getItem(key);
    data.scopes[key] = scope;
  }
  if (includeGeocodeCache) {
    const geo = localStorage.getItem(GEOCODE_CACHE_STORAGE_KEY);
    if (geo != null) data.keys[GEOCODE_CACHE_STORAGE_KEY] = geo;
  }
  return data;
}

export function restoreBackupBundle(bundle, { merge = false } = {}) {
  const orgId = getOrgId();
  const validation = validateBackupBundle(bundle, { orgId });
  if (!validation.ok) throw new Error(validation.message);
  if (!confirm(merge ? "Merge keys from backup? Existing values may be overwritten where keys match." : "Replace all matching keys on this device? This cannot be undone.")) {
    return { applied: 0, skipped: true };
  }
  if (getOrgId() !== orgId) throw new Error("Organisation changed during backup restore.");
  let applied = 0;
  for (const [key, value] of Object.entries(bundle.keys)) {
    if (LEGACY_GLOBAL_KEYS.includes(key)) continue;
    localStorage.setItem(key, value);
    applied++;
  }
  return { applied, skipped: false };
}
