import { useMemo } from "react";
import { ms } from "../utils/moduleStyles";
import { canUseFessExclusiveFeatures } from "../utils/fessExclusive";
import { buildFessWorkspacePulse } from "../utils/fessPulse";
import { openWorkspaceView } from "../utils/workspaceNavContext";

const ss = ms;

const SEVERITY_STYLE = {
  urgent: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", dot: "#dc2626" },
  warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", dot: "#d97706" },
  info: { bg: "#f0fdfa", border: "#99f6e4", color: "#115e59", dot: "#0d9488" },
};

/**
 * @param {object} props
 * @param {object[]} [props.rams]
 * @param {object[]} [props.permits]
 * @param {object[]} [props.methodStatements]
 * @param {object[]} [props.workers]
 * @param {object[]} [props.projects]
 */
export default function FessPulseCard({ rams = [], permits = [], methodStatements = [], workers = [], projects = [] }) {
  const pulse = useMemo(
    () => buildFessWorkspacePulse({ rams, permits, methodStatements, workers, projects }),
    [rams, permits, methodStatements, workers, projects]
  );

  if (!canUseFessExclusiveFeatures()) return null;

  if (!pulse.items.length) {
    return (
      <div
        style={{
          ...ss.card,
          marginBottom: 12,
          padding: "12px 16px",
          border: "1px solid #99f6e4",
          background: "#f0fdfa",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, color: "#0f766e" }}>
          <strong>FESS pulse</strong> — no open actions on live sites right now.
        </div>
        <button type="button" style={{ ...ss.btn, fontSize: 12, padding: "6px 12px" }} onClick={() => openWorkspaceView({ viewId: "fess-sites" })}>
          Client & sites
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        ...ss.card,
        marginBottom: 12,
        padding: 14,
        border: "1px solid #5eead4",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#0f766e", textTransform: "uppercase" }}>
          FESS pulse · live sites
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {pulse.counts.lineClearanceOpen > 0 ? (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#fef2f2", color: "#991b1b" }}>
              {pulse.counts.lineClearanceOpen} line clearance
            </span>
          ) : null}
          {pulse.counts.awaitingClientApproval > 0 ? (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#fffbeb", color: "#92400e" }}>
              {pulse.counts.awaitingClientApproval} approval
            </span>
          ) : null}
          {pulse.counts.unpublishedPortals > 0 ? (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#eff6ff", color: "#1d4ed8" }}>
              {pulse.counts.unpublishedPortals} portal publish
            </span>
          ) : null}
        </div>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {pulse.items.map((item) => {
          const style = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.info;
          return (
            <li
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${style.border}`,
                background: style.bg,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: style.color }}>{item.label}</span>
                </div>
                {item.detail ? (
                  <div style={{ fontSize: 11, color: style.color, opacity: 0.85, marginTop: 4, marginLeft: 16 }}>
                    {item.detail}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                style={{ ...ss.btn, fontSize: 11, padding: "6px 12px", flexShrink: 0 }}
                onClick={() => openWorkspaceView({ viewId: item.viewId })}
              >
                Open
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
