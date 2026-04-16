import { openWorkspaceView } from "../utils/workspaceNavContext";

const card = {
  marginBottom: 20,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid var(--color-border-tertiary,#e2e8f0)",
  background: "var(--color-background-primary,#fff)",
  boxShadow: "var(--shadow-sm)",
};

const btn = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border-secondary,#cbd5e1)",
  background: "var(--color-background-primary,#fff)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "var(--color-text-primary)",
};

/**
 * Compact “site today” snapshot for the dashboard — jumps to Permits, RAMS, Workers, Site map.
 */
export default function SiteTodayCard({ workerCount, activePermits, ramsCount, todaySignIns }) {
  return (
    <div style={card}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 10,
        }}
      >
        Site today
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: 12,
          fontSize: 13,
          color: "var(--color-text-primary)",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{activePermits}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)" }}>Active permits</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{ramsCount}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)" }}>RAMS docs</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{workerCount}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)" }}>Workers</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{todaySignIns}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)" }}>Sign-ins today</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={btn} onClick={() => openWorkspaceView({ viewId: "permits" })}>
          Permits
        </button>
        <button type="button" style={btn} onClick={() => openWorkspaceView({ viewId: "rams" })}>
          RAMS
        </button>
        <button type="button" style={btn} onClick={() => openWorkspaceView({ viewId: "workers" })}>
          Workers
        </button>
        <button type="button" style={btn} onClick={() => openWorkspaceView({ viewId: "site-map" })}>
          Site map
        </button>
      </div>
    </div>
  );
}
