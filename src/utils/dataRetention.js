/**
 * Local retention helpers (ISO 27001 evidence + GDPR lifecycle).
 * Legal holds for health/COSHH (up to 40y) remain a process decision — this module
 * only auto-expires operational copies that already have a documented TTL.
 */
import { orgScopedKey } from "./orgId";
import { purgeExpiredRecycleBinEntries } from "./recycleBin";

/** Local device audit trail retention (years). Row cap in auditLog still applies. */
export const LOCAL_AUDIT_RETENTION_YEARS = 7;

function auditStorageKey() {
  return orgScopedKey("mysafeops_audit");
}

/**
 * Drop local audit rows older than retention. Returns number removed.
 * Does not touch D1 hash-chained server audit.
 */
export function purgeExpiredLocalAudit(now = Date.now()) {
  const cutoff = now - LOCAL_AUDIT_RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(auditStorageKey()) || "[]");
    if (!Array.isArray(list)) list = [];
  } catch {
    return 0;
  }
  const kept = list.filter((row) => {
    const t = new Date(row?.at || 0).getTime();
    if (!Number.isFinite(t)) return false;
    return t >= cutoff;
  });
  const removed = list.length - kept.length;
  if (removed <= 0) return 0;
  try {
    localStorage.setItem(auditStorageKey(), JSON.stringify(kept));
  } catch {
    return 0;
  }
  return removed;
}

/**
 * Run cheap local retention jobs (safe to call on app boot / focus).
 * @returns {{ auditRemoved: number, recycleRemoved: number }}
 */
export function runLocalRetentionJobs(now = Date.now()) {
  const auditRemoved = purgeExpiredLocalAudit(now);
  const recycleRemoved = purgeExpiredRecycleBinEntries();
  return { auditRemoved, recycleRemoved };
}
