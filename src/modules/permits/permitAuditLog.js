const MAX_ENTRIES = 40;

/**
 * Shared classification for local audit log and Supabase `org_permit_audit`.
 * @param {object | undefined} prevPermit
 * @param {object} nextPermit
 * @returns {{ action: string, fromStatus: string | null, toStatus: string | null }}
 */
export function describePermitAuditEvent(prevPermit, nextPermit) {
  if (nextPermit?._auditAction) {
    return {
      action: String(nextPermit._auditAction),
      fromStatus: prevPermit?.status != null ? String(prevPermit.status) : null,
      toStatus: nextPermit?.status != null ? String(nextPermit.status) : null,
    };
  }
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
  const base = {
    type: permit.type ?? null,
    status: permit.status ?? null,
    location: permit.location ? String(permit.location).slice(0, 240) : null,
    descriptionPreview: permit.description ? String(permit.description).slice(0, 120) : null,
  };
  if (permit._auditAction === "conflict_warn_override") {
    return {
      ...base,
      conflictWarnOverride: {
        reason: permit.conflictWarnOverride?.reason ? String(permit.conflictWarnOverride.reason).slice(0, 400) : "",
        approvedBy: permit.conflictWarnOverride?.approvedBy ? String(permit.conflictWarnOverride.approvedBy).slice(0, 120) : "",
      },
    };
  }
  if (String(permit._auditAction || "").startsWith("handover_")) {
    const e = permit.handoverEntry || {};
    return {
      ...base,
      handover: {
        whatChanged: e.whatChanged ? String(e.whatChanged).slice(0, 240) : "",
        remainingHighRisk: e.remainingHighRisk ? String(e.remainingHighRisk).slice(0, 240) : "",
        outgoingSupervisor: e.outgoingSupervisor ? String(e.outgoingSupervisor).slice(0, 120) : "",
        incomingSupervisor: e.incomingSupervisor ? String(e.incomingSupervisor).slice(0, 120) : "",
      },
    };
  }
  return base;
}

function buildLocalEntry(prevPermit, nextPermit) {
  const at = new Date().toISOString();
  const d = describePermitAuditEvent(prevPermit, nextPermit);
  if (d.action === "created") return { at, action: "created" };
  if (d.action === "conflict_warn_override") {
    return {
      at,
      action: "conflict_warn_override",
      approvedBy: nextPermit?.conflictWarnOverride?.approvedBy || "",
      reason: nextPermit?.conflictWarnOverride?.reason || "",
    };
  }
  if (d.action === "handover_submitted") {
    return {
      at,
      action: "handover_submitted",
      outgoingSupervisor: nextPermit?.handoverEntry?.outgoingSupervisor || "",
      incomingSupervisor: nextPermit?.handoverEntry?.incomingSupervisor || "",
    };
  }
  if (d.action === "handover_ack_outgoing") {
    return {
      at,
      action: "handover_ack_outgoing",
      by: nextPermit?.handoverEntry?.outgoingSupervisor || "",
    };
  }
  if (d.action === "handover_ack_incoming") {
    return {
      at,
      action: "handover_ack_incoming",
      by: nextPermit?.handoverEntry?.incomingSupervisor || "",
    };
  }
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
