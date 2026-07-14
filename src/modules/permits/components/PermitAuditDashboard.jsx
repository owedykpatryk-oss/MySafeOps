import { useMemo } from "react";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Summarise cloud audit rows for dashboard cards. */
export function summarisePermitAuditRows(rows = [], permits = []) {
  const list = Array.isArray(rows) ? rows : [];
  const todayStart = startOfDay(new Date()).getTime();
  const weekAgo = todayStart - 7 * 86400000;

  const byAction = {};
  let todayCount = 0;
  let weekCount = 0;
  let statusChanges = 0;
  let handovers = 0;
  let overrides = 0;

  list.forEach((row) => {
    const action = String(row?.action || "unknown").toLowerCase();
    byAction[action] = (byAction[action] || 0) + 1;
    const t = new Date(row?.occurred_at || row?.created_at || 0).getTime();
    if (Number.isFinite(t)) {
      if (t >= todayStart) todayCount += 1;
      if (t >= weekAgo) weekCount += 1;
    }
    if (action === "status_changed") statusChanges += 1;
    if (action.includes("handover")) handovers += 1;
    if (action.includes("conflict")) overrides += 1;
  });

  const activePermits = (Array.isArray(permits) ? permits : []).filter(
    (p) => String(p?.status || "").toLowerCase() === "active"
  ).length;

  const topActions = Object.entries(byAction)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    totalLoaded: list.length,
    todayCount,
    weekCount,
    statusChanges,
    handovers,
    overrides,
    activePermits,
    topActions,
  };
}

export default function PermitAuditDashboard({ rows = [], permits = [], loading = false }) {
  const stats = useMemo(() => summarisePermitAuditRows(rows, permits), [rows, permits]);

  const cards = [
    { label: "Events today", value: stats.todayCount, tone: "teal" },
    { label: "Last 7 days", value: stats.weekCount, tone: "slate" },
    { label: "Status changes", value: stats.statusChanges, tone: "blue" },
    { label: "Handovers", value: stats.handovers, tone: "amber" },
    { label: "Active permits", value: stats.activePermits, tone: "green" },
  ];

  return (
    <div className="ptw-audit-dash">
      <div className="ptw-audit-dash__cards">
        {cards.map((c) => (
          <div key={c.label} className={`ptw-audit-dash__card ptw-audit-dash__card--${c.tone}`}>
            <div className="ptw-audit-dash__card-label">{c.label}</div>
            <div className="ptw-audit-dash__card-value">{loading ? "…" : c.value}</div>
          </div>
        ))}
      </div>
      {stats.topActions.length > 0 ? (
        <div className="ptw-audit-dash__actions">
          <div className="ptw-audit-dash__actions-title">Top actions (current page)</div>
          <div className="ptw-audit-dash__bars">
            {stats.topActions.map(([action, count]) => {
              const max = stats.topActions[0][1] || 1;
              const pct = Math.round((count / max) * 100);
              return (
                <div key={action} className="ptw-audit-dash__bar-row">
                  <span className="ptw-audit-dash__bar-label">{action.replace(/_/g, " ")}</span>
                  <div className="ptw-audit-dash__bar-track">
                    <div className="ptw-audit-dash__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="ptw-audit-dash__bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="ptw-audit-dash__empty">Refresh audit to populate dashboard metrics.</div>
      )}
    </div>
  );
}
