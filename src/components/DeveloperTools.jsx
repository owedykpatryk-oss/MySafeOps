import { useMemo, useState } from "react";
import { ms } from "../utils/moduleStyles";
import { getFeatureFlags, saveFeatureFlags } from "../utils/featureFlags";
import { clearTelemetryEvents, getTelemetryEvents } from "../utils/telemetry";

const ss = {
  ...ms,
  card: { ...ms.card, marginBottom: 16, padding: 14 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--color-border-tertiary,#e5e5e5)" },
};

export default function DeveloperTools() {
  const [flags, setFlags] = useState(() => getFeatureFlags());
  const [telemetryLimit, setTelemetryLimit] = useState(50);
  const [telemetryTick, setTelemetryTick] = useState(0);
  const events = useMemo(() => getTelemetryEvents(telemetryLimit), [telemetryLimit, telemetryTick]);

  const toggle = (key) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    saveFeatureFlags({ [key]: next[key] });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mysafeops-telemetry-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const flagEntries = Object.entries(flags).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", fontSize: 14, color: "var(--color-text-primary)" }}>
      <div style={ss.card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          Feature flags (this browser / org scope)
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>
          Toggles apply immediately. Stored with your org-scoped local data.
        </p>
        {flagEntries.map(([key, on]) => (
          <label key={key} style={{ ...ss.row, cursor: "pointer" }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{key}</span>
            <input type="checkbox" checked={!!on} onChange={() => toggle(key)} style={{ width: 18, height: 18, accentColor: "#0d9488" }} />
          </label>
        ))}
      </div>

      <div style={ss.card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Recent telemetry (local)
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={telemetryLimit} onChange={(e) => setTelemetryLimit(Number(e.target.value))} style={ss.inp}>
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  Last {n}
                </option>
              ))}
            </select>
            <button type="button" onClick={exportJson} style={ss.btn}>
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear all stored telemetry events for this org?")) {
                  clearTelemetryEvents();
                  setTelemetryTick((t) => t + 1);
                }
              }}
              style={{ ...ss.btn, color: "#791F1F", borderColor: "#F09595" }}
            >
              Clear
            </button>
          </div>
        </div>
        {events.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>No events recorded yet.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 360, overflow: "auto" }}>
            {events.map((ev, i) => (
              <li key={`${ev.at}-${i}`} style={{ fontSize: 11, padding: "6px 0", borderBottom: "1px solid var(--color-border-tertiary,#eee)" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>{ev.at}</span>
                <span style={{ fontWeight: 600, marginLeft: 8 }}>{ev.name}</span>
                {ev.payload && Object.keys(ev.payload).length > 0 ? (
                  <pre style={{ margin: "4px 0 0", fontSize: 10, overflow: "auto", whiteSpace: "pre-wrap" }}>{JSON.stringify(ev.payload)}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
