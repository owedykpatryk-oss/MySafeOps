import { useMemo } from "react";

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

function toneForSeverity(severity) {
  if (severity === "critical") {
    return { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", chip: "#dc2626" };
  }
  if (severity === "warning") {
    return { bg: "#fffbeb", border: "#fde68a", color: "#92400e", chip: "#d97706" };
  }
  return { bg: "#f0f9ff", border: "#bae6fd", color: "#0c4a6e", chip: "#0284c7" };
}

export default function PermitCommandCentre({
  opsActionItems = [],
  commandCounts = {},
  permitScorecard = {},
  onFixNext,
  onOpenPermit,
  onOpenWall,
  onOpenMap,
  compact = false,
}) {
  const sorted = useMemo(
    () =>
      [...opsActionItems].sort(
        (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
      ),
    [opsActionItems]
  );

  const critical = sorted.filter((x) => x.severity === "critical").length;
  const warning = sorted.filter((x) => x.severity === "warning").length;
  const next = sorted[0] || null;

  const heroMetrics = [
    { label: "Critical", value: critical, alert: critical > 0 },
    { label: "Warnings", value: warning, alert: false },
    { label: "Active", value: commandCounts.active ?? 0, alert: false },
    { label: "Handover due", value: commandCounts.handoverDue ?? 0, alert: (commandCounts.handoverDue ?? 0) > 0 },
    { label: "Blocked", value: commandCounts.blockedNow ?? 0, alert: (commandCounts.blockedNow ?? 0) > 0 },
    { label: "Overdue SLA", value: permitScorecard.overdueQueue ?? 0, alert: (permitScorecard.overdueQueue ?? 0) > 0 },
  ];

  return (
    <div
      className="app-panel-surface"
      style={{
        padding: compact ? 12 : 16,
        borderRadius: 14,
        marginBottom: 16,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 48%, #0f766e 120%)",
        color: "#f8fafc",
        border: "1px solid #334155",
        boxShadow: "0 12px 40px rgba(15,23,42,0.18)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: compact ? 13 : 15, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5eead4" }}>
            Permit command centre
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, maxWidth: 520 }}>
            Live ops snapshot — what needs attention now across review, activation, handover and conflicts.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onFixNext && next ? (
            <button
              type="button"
              onClick={() => onFixNext(next)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "#f97316",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Fix next →
            </button>
          ) : null}
          {onOpenWall ? (
            <button
              type="button"
              onClick={onOpenWall}
              style={{
                fontSize: 12,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #475569",
                background: "rgba(15,23,42,0.5)",
                color: "#e2e8f0",
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Open TV wall
            </button>
          ) : null}
          {onOpenMap ? (
            <button
              type="button"
              onClick={onOpenMap}
              style={{
                fontSize: 12,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #475569",
                background: "rgba(15,23,42,0.5)",
                color: "#e2e8f0",
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Safety map
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "repeat(3,minmax(0,1fr))" : "repeat(6,minmax(0,1fr))",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {heroMetrics.map((m) => (
          <div
            key={m.label}
            style={{
              borderRadius: 10,
              padding: "10px 12px",
              background: m.alert ? "rgba(127,29,29,0.55)" : "rgba(15,23,42,0.55)",
              border: `1px solid ${m.alert ? "#b91c1c" : "#334155"}`,
            }}
          >
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
          </div>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: "#86efac", padding: "10px 12px", borderRadius: 8, background: "rgba(20,83,45,0.35)", border: "1px solid #166534" }}>
          All clear — no urgent permit actions right now.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, maxHeight: compact ? 280 : 360, overflowY: "auto" }}>
          {sorted.slice(0, compact ? 8 : 14).map((item) => {
            const tone = toneForSeverity(item.severity);
            return (
              <div
                key={`${item.kind}:${item.permitId}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.color,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: tone.chip,
                        color: "#fff",
                      }}
                    >
                      {item.severity}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>{item.detail}</div>
                  <div style={{ fontSize: 10, marginTop: 3, opacity: 0.75 }}>Permit {item.permitId}</div>
                </div>
                {onOpenPermit ? (
                  <button
                    type="button"
                    onClick={() => onOpenPermit(item)}
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 7,
                      border: `1px solid ${tone.border}`,
                      background: "#fff",
                      color: tone.color,
                      cursor: "pointer",
                      fontFamily: "DM Sans,sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
