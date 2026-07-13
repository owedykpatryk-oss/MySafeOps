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
  const stats = {
    active: 0,
    expired: 0,
    draft: 0,
    closed: 0,
    pendingReview: 0,
    approved: 0,
    expiringSoon: 0,
  };
  for (const p of permits) {
    const status = derivePermitStatus(p, now);
    if (status === "active") {
      stats.active += 1;
      const endIso = permitEndIso(p);
      if (endIso && new Date(endIso) - now < soonMs) stats.expiringSoon += 1;
    } else if (status === "expired") stats.expired += 1;
    else if (status === "draft") stats.draft += 1;
    else if (status === "closed") stats.closed += 1;
    else if (status === "pending_review") stats.pendingReview += 1;
    else if (status === "approved") stats.approved += 1;
  }
  return stats;
}

export function permitsHeatmap(permits = [], permitTypes = {}, now = new Date()) {
  const statusOrder = ["draft", "pending_review", "approved", "active", "expired", "closed"];
  const counts = Object.create(null);
  for (const p of permits) {
    const type = p?.type;
    if (!type || !permitTypes[type]) continue;
    const status = derivePermitStatus(p, now);
    const key = `${type}\0${status}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.keys(permitTypes).map((type) => {
    const row = { type, label: permitTypes[type]?.label || type };
    statusOrder.forEach((status) => {
      row[status] = counts[`${type}\0${status}`] || 0;
    });
    row.total = statusOrder.reduce((sum, status) => sum + row[status], 0);
    return row;
  });
}
