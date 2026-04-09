import { derivePermitStatus } from "./permitRules";

function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function buildPermitRiskInsights(permits = [], incidents = [], now = new Date()) {
  const activeDurations = (permits || [])
    .filter((p) => derivePermitStatus(p, now) === "closed" && p.startDateTime && p.closedAt)
    .map((p) => Math.max(0, new Date(p.closedAt).getTime() - new Date(p.startDateTime).getTime()) / 3600000);
  const medianClosedHours = activeDurations.length
    ? [...activeDurations].sort((a, b) => a - b)[Math.floor(activeDurations.length / 2)]
    : 0;

  const reopenCount = (permits || []).reduce((sum, p) => {
    const changes = Array.isArray(p.auditLog) ? p.auditLog : [];
    return sum + changes.filter((c) => c.action === "status_changed" && c.to === "active" && c.from === "closed").length;
  }, 0);

  const byType = {};
  (permits || []).forEach((p) => {
    const t = p.type || "general";
    if (!byType[t]) byType[t] = { type: t, total: 0, expired: 0 };
    byType[t].total += 1;
    if (derivePermitStatus(p, now) === "expired") byType[t].expired += 1;
  });
  const hotspots = Object.values(byType)
    .map((r) => ({ ...r, expiredRate: r.total ? Number((r.expired / r.total).toFixed(2)) : 0 }))
    .sort((a, b) => b.expiredRate - a.expiredRate)
    .slice(0, 5);

  const incidentDensity = permits.length ? Number((incidents.length / permits.length).toFixed(2)) : 0;
  const severityCounts = {};
  (incidents || []).forEach((i) => {
    const k = i.severity || "near_miss";
    severityCounts[k] = (severityCounts[k] || 0) + 1;
  });

  return {
    medianClosedHours: Number(medianClosedHours.toFixed(1)),
    avgClosedHours: Number(mean(activeDurations).toFixed(1)),
    reopenCount,
    incidentDensity,
    severityCounts,
    hotspots,
  };
}

