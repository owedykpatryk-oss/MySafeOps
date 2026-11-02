import { BACKUP_NAMESPACES } from "./backupNamespaces.js";
// Unowned legacy settings and the active organisation selector must never be restored.
export const LEGACY_GLOBAL_KEYS = ["mysafeops_org_settings", "mysafeops_orgId", "mysafeops_notif_seen"];

export function backupKeyScope(key, orgId) {
  if (typeof key !== "string" || !orgId) return null;
  const parts = key.split("__country_");
  if (parts.length > 2) return null;
  const countryId = parts.length === 2 ? parts[1] : null;
  if (countryId !== null && !/^[a-zA-Z0-9-]+$/.test(countryId)) return null;
  const suffix = `_${orgId}`;
  if (!parts[0].endsWith(suffix)) return null;
  const namespace = parts[0].slice(0, -suffix.length);
  if (!BACKUP_NAMESPACES.has(namespace)) return null;
  return { orgId, namespace, countryId };
}

export function validateBackupBundle(bundle, { orgId } = {}) {
  if (!bundle || typeof bundle !== "object") return { ok: false, message: "Backup must be a JSON object." };
  if (bundle.version != null && ![1, 2].includes(bundle.version)) {
    return { ok: false, message: `Unsupported backup version (${bundle.version}).` };
  }
  if (!bundle.keys || typeof bundle.keys !== "object" || Array.isArray(bundle.keys)) {
    return { ok: false, message: 'Invalid backup: missing "keys" object.' };
  }
  const entries = Object.entries(bundle.keys);
  if (!entries.length) return { ok: false, message: "Backup contains no keys." };
  if (typeof bundle.orgId !== "string" || !bundle.orgId || (orgId && bundle.orgId !== orgId)) {
    return { ok: false, message: "Backup organisation does not match the selected organisation." };
  }
  for (const [key, value] of entries) {
    if (typeof value !== "string") return { ok: false, message: `Invalid backup value: ${key}` };
    if (LEGACY_GLOBAL_KEYS.includes(key) && bundle.version !== 2) continue;
    if (key === "mysafeops_geocode_cache") continue;
    const scope = backupKeyScope(key, bundle.orgId);
    if (!scope) return { ok: false, message: `Backup key is outside the organisation: ${key}` };
    if (bundle.version === 2) {
      const manifest = bundle.scopes?.[key];
      if (!manifest || manifest.orgId !== scope.orgId || manifest.namespace !== scope.namespace || manifest.countryId !== scope.countryId) {
        return { ok: false, message: `Backup scope manifest mismatch: ${key}` };
      }
    }
  }
  return { ok: true, keyCount: entries.length };
}
