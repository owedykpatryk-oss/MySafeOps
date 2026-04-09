import { derivePermitStatus, permitEndIso } from "./permitRules";

function toMs(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function buildPermitSlaQueue(permits = [], incidents = [], now = new Date()) {
  const nowMs = now.getTime();
  const queue = [];

  (permits || []).forEach((p) => {
    const status = derivePermitStatus(p, now);
    const endMs = toMs(permitEndIso(p));
    const createdMs = toMs(p.createdAt);
    if (status === "pending_review" && createdMs && nowMs - createdMs > 6 * 60 * 60 * 1000) {
      queue.push({
        id: `sla_review_${p.id}`,
        kind: "review_timeout",
        severity: "warning",
        permitId: p.id,
        title: "Pending review exceeded SLA (6h)",
        detail: `${p.location || "Unknown location"} · ${p.type || "permit"}`,
      });
    }
    if (status === "active" && endMs && endMs - nowMs < 2 * 60 * 60 * 1000 && endMs > nowMs) {
      queue.push({
        id: `sla_expiry_${p.id}`,
        kind: "expiring_soon",
        severity: "warning",
        permitId: p.id,
        title: "Active permit expiring within 2h",
        detail: `${p.location || "Unknown location"} · ${p.type || "permit"}`,
      });
    }
    if (status === "expired") {
      queue.push({
        id: `sla_expired_${p.id}`,
        kind: "expired_open",
        severity: "critical",
        permitId: p.id,
        title: "Expired permit still open",
        detail: `${p.location || "Unknown location"} · ${p.type || "permit"}`,
      });
    }
  });

  (incidents || []).forEach((i) => {
    (i.correctiveActions || []).forEach((a) => {
      if (a.status === "closed") return;
      const dueMs = toMs(a.dueAt);
      if (!dueMs) return;
      if (dueMs < nowMs) {
        queue.push({
          id: `sla_action_${i.id}_${a.id}`,
          kind: "corrective_overdue",
          severity: "critical",
          permitId: i.permitId,
          incidentId: i.id,
          title: "Corrective action overdue",
          detail: `${i.title || "Incident"} · owner: ${a.owner || "unassigned"}`,
        });
      }
    });
  });

  const rank = { critical: 0, warning: 1, info: 2 };
  return queue.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
}

export function buildPermitDigest(permits = [], incidents = [], now = new Date()) {
  const statuses = { draft: 0, pending_review: 0, approved: 0, active: 0, expired: 0, closed: 0 };
  (permits || []).forEach((p) => {
    const s = derivePermitStatus(p, now);
    if (Object.prototype.hasOwnProperty.call(statuses, s)) statuses[s] += 1;
  });
  const openIncidents = (incidents || []).filter((i) => i.status !== "closed").length;
  const openActions = (incidents || []).reduce(
    (sum, i) => sum + (i.correctiveActions || []).filter((a) => a.status !== "closed").length,
    0
  );
  return {
    generatedAt: now.toISOString(),
    statuses,
    openIncidents,
    openActions,
  };
}

