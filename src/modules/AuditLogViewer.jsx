import { useEffect, useMemo, useState } from "react";
import { readAudit, clearAudit } from "../utils/auditLog";
import { useApp } from "../context/AppContext";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { getOrgId } from "../utils/orgStorage";
import { supabase } from "../lib/supabase";
import { d1ListServerAudit, isD1Configured } from "../lib/d1SyncClient";

const ss = ms;
const AUDIT_PAGE = 120;

export default function AuditLogViewer() {
  const { caps } = useApp();
  const [bump, setBump] = useState(0);
  const [serverRows, setServerRows] = useState([]);
  const [serverStatus, setServerStatus] = useState("idle");
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!isD1Configured() || !supabase) {
      setServerRows([]);
      setServerStatus("skipped");
      setServerError("");
      return;
    }
    const org = getOrgId();
    if (!org || org === "default") {
      setServerRows([]);
      setServerStatus("skipped");
      setServerError("");
      return;
    }
    let cancelled = false;
    setServerStatus("loading");
    (async () => {
      const r = await d1ListServerAudit(supabase, org, { limit: 500, afterSeq: 0 });
      if (cancelled) return;
      if (!r.ok) {
        setServerRows([]);
        setServerError(r.error || "d1_audit_fetch_failed");
        setServerStatus("error");
        return;
      }
      setServerError("");
      setServerStatus("ok");
      setServerRows(
        (r.items || []).map((it) => ({
          id: `d1seq_${it.seq}`,
          at: it.created_at,
          action: it.action,
          entity: it.entity,
          detail: it.detail || "",
          source: "server",
          seq: it.seq,
          clientRowId: it.client_row_id || null,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [bump, supabase]);

  const rows = useMemo(() => {
    const local = readAudit().map((r) => ({ ...r, source: "local" }));
    const mirrored = new Set(
      serverRows.map((s) => s.clientRowId).filter(Boolean)
    );
    const localOnly = local.filter((r) => !mirrored.has(r.id));
    return [...serverRows, ...localOnly].sort(
      (a, b) => new Date(b.at) - new Date(a.at)
    );
  }, [bump, serverRows]);

  const [visible, setVisible] = useState(AUDIT_PAGE);

  const refresh = () => {
    setVisible(AUDIT_PAGE);
    setBump((x) => x + 1);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="LOG"
        title="Audit log"
        lead="Local ring (max 500) plus server copy when D1 is configured. Clear removes only the browser list; D1 append-only log stays in the cloud."
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
      {serverStatus === "loading" ? (
        <div style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 10 }}>Loading server audit…</div>
      ) : null}
      {serverError && serverError !== "d1_not_configured" ? (
        <div style={{ color: "#b45309", fontSize: 13, marginBottom: 10 }}>Server audit: {serverError}</div>
      ) : null}

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
                  {r.source === "server" ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        marginRight: 8,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "var(--color-background-tertiary, #e8f4f2)",
                        color: "var(--color-accent, #0d9488)",
                      }}
                    >
                      D1
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        marginRight: 8,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "var(--color-background-tertiary, #f1f5f9)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      local
                    </span>
                  )}
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
