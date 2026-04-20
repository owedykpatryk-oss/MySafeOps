import { useMemo, useState } from "react";
import { readAudit, clearAudit } from "../utils/auditLog";
import { useApp } from "../context/AppContext";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";

const ss = ms;
const AUDIT_PAGE = 120;

export default function AuditLogViewer() {
  const { caps } = useApp();
  const [, bump] = useState(0);
  const rows = useMemo(() => readAudit(), [bump]);
  const [visible, setVisible] = useState(AUDIT_PAGE);

  const refresh = () => {
    setVisible(AUDIT_PAGE);
    bump((x) => x + 1);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="LOG"
        title="Audit log"
        lead="Recent actions (max 500) — backups, AI generation, templates, role changes where instrumented."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        }
      />
      <div style={ss.card}>
        {rows.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>No entries yet.</div>
        ) : (
          <div style={{ maxHeight: 480, overflow: "auto" }}>
            {rows.slice(0, visible).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                  fontSize: 13,
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 52px",
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
            {visible < rows.length ? (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                <button type="button" style={ss.btn} onClick={() => setVisible((v) => v + AUDIT_PAGE)}>
                  Show more ({rows.length - visible} remaining)
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
