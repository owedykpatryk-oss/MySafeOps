import { useMemo, useState } from "react";
import { readAudit, clearAudit } from "../utils/auditLog";
import { useApp } from "../context/AppContext";

const ss = {
  btn: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif" },
  card: { background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: "1.25rem" },
};

export default function AuditLogViewer() {
  const { caps } = useApp();
  const [, bump] = useState(0);
  const rows = useMemo(() => readAudit(), [bump]);

  const refresh = () => bump((x) => x + 1);

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontWeight: 500, fontSize: 20, margin: 0 }}>Audit log</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            Recent actions (max 500) — backups, AI generation, templates, role changes where instrumented
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={ss.btn} onClick={refresh}>
            Refresh
          </button>
          {caps.backupImport && (
            <button
              type="button"
              style={{ ...ss.btn, color: "#A32D2D", borderColor: "#F09595" }}
              onClick={() => {
                if (confirm("Clear audit log for this organisation?")) {
                  clearAudit();
                  refresh();
                }
              }}
            >
              Clear log
            </button>
          )}
        </div>
      </div>
      <div style={ss.card}>
        {rows.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>No entries yet.</div>
        ) : (
          <div style={{ maxHeight: 480, overflow: "auto" }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{new Date(r.at).toLocaleString("en-GB")}</div>
                <div>
                  <strong>{r.action}</strong>
                  {r.entity && ` · ${r.entity}`}
                  {r.detail && <span style={{ color: "var(--color-text-secondary)" }}> — {r.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
