/** Collect / restore MySafeOps localStorage keys for org + global org settings */

const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";

const GLOBAL_KEYS = ["mysafeops_org_settings", "mysafeops_orgId", "mysafeops_notif_prefs", "mysafeops_notif_seen"];

export function collectBackupBundle() {
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
