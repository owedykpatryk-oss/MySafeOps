const MAX_ENTRIES = 40;

/**
 * Shared classification for local audit log and Supabase `org_permit_audit`.
 * @param {object | undefined} prevPermit
 * @param {object} nextPermit
 * @returns {{ action: string, fromStatus: string | null, toStatus: string | null }}
 */
export function describePermitAuditEvent(prevPermit, nextPermit) {
  if (!prevPermit) {
    return { action: "created", fromStatus: null, toStatus: nextPermit?.status != null ? String(nextPermit.status) : null };
  }
  if (prevPermit.status !== nextPermit.status) {
    return {
      action: "status_changed",
      fromStatus: String(prevPermit.status ?? ""),
      toStatus: String(nextPermit.status ?? ""),
    };
  }
  return { action: "updated", fromStatus: null, toStatus: null };
}

/** Small JSON for `org_permit_audit.detail` (not a full permit dump). */
export function permitAuditDetailSnapshot(permit) {
  if (!permit || typeof permit !== "object") return {};
  return {
    type: permit.type ?? null,
    status: permit.status ?? null,
    location: permit.location ? String(permit.location).slice(0, 240) : null,
    descriptionPreview: permit.description ? String(permit.description).slice(0, 120) : null,
  };
}

function buildLocalEntry(prevPermit, nextPermit) {
  const at = new Date().toISOString();
  const d = describePermitAuditEvent(prevPermit, nextPermit);
  if (d.action === "created") return { at, action: "created" };
  if (d.action === "status_changed") return { at, action: "status_changed", from: d.fromStatus, to: d.toStatus };
  return { at, action: "updated" };
}

/**
 * Append a compact audit entry when a permit is created or saved.
 * @param {object | undefined} prevPermit — previous row from store, if any
 * @param {object} nextPermit — permit being written (may already carry stale auditLog)
 * @returns {object[]}
 */
export function appendPermitAuditEntry(prevPermit, nextPermit) {
  const base = Array.isArray(prevPermit?.auditLog) ? [...prevPermit.auditLog] : [];
  return [...base, buildLocalEntry(prevPermit, nextPermit)].slice(-MAX_ENTRIES);
}
