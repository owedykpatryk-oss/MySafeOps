export function permitEndIso(permit) {
  return permit?.endDateTime || permit?.expiryDate || "";
}

export function derivePermitStatus(permit, now = new Date()) {
  if (permit?.status === "closed") return "closed";
  if (permit?.status === "draft") return "draft";
  if (permit?.status === "pending_review") return "pending_review";
  if (permit?.status === "ready_for_review") return "pending_review";
  if (permit?.status === "approved") return "approved";
  if (permit?.status === "suspended") return "suspended";
  const endIso = permitEndIso(permit);
  if (permit?.status === "active" && endIso && new Date(endIso) < now) return "expired";
  return permit?.status || "active";
}

export function buildPermitWarRoomStats(permits = [], now = new Date()) {
  const soonMs = 2 * 60 * 60 * 1000;
  const active = permits.filter((p) => derivePermitStatus(p, now) === "active");
  const expired = permits.filter((p) => derivePermitStatus(p, now) === "expired");
  const draft = permits.filter((p) => derivePermitStatus(p, now) === "draft");
  const closed = permits.filter((p) => derivePermitStatus(p, now) === "closed");
  const pendingReview = permits.filter((p) => derivePermitStatus(p, now) === "pending_review");
  const approved = permits.filter((p) => derivePermitStatus(p, now) === "approved");
  const expiringSoon = active.filter((p) => {
    const endIso = permitEndIso(p);
    return endIso && new Date(endIso) - now < soonMs;
  });
  return {
    active: active.length,
    expired: expired.length,
    draft: draft.length,
    closed: closed.length,
    pendingReview: pendingReview.length,
    approved: approved.length,
    expiringSoon: expiringSoon.length,
  };
}

export function permitsHeatmap(permits = [], permitTypes = {}) {
  const statusOrder = ["draft", "pending_review", "approved", "active", "expired", "closed"];
  return Object.keys(permitTypes).map((type) => {
    const row = { type, label: permitTypes[type]?.label || type };
    statusOrder.forEach((status) => {
      row[status] = permits.filter((p) => p.type === type && derivePermitStatus(p) === status).length;
    });
    row.total = statusOrder.reduce((sum, status) => sum + row[status], 0);
    return row;
  });
}
