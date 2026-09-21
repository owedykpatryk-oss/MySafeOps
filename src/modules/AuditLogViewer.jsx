import { useEffect, useMemo, useState } from "react";
import { readAudit, clearAudit } from "../utils/auditLog";
import { readOpsLog, clearOpsLog, exportOpsLogJson } from "../utils/clientOpsMonitor.js";
import { useApp } from "../context/AppContext";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import { getOrgId } from "../utils/orgStorage";
import { supabase } from "../lib/supabase";
import { d1ListServerAudit, isD1Configured } from "../lib/d1SyncClient";
import { useListWindow } from "../utils/useListWindow.js";
import { formatActorLabel } from "../utils/documentAuthorship.js";

import { todayLocalISO } from "../utils/localDate";
const ss = ms;
const AUDIT_PAGE = 120;

export default function AuditLogViewer() {
  const { caps, role } = useApp();
  const canReadServerAudit = role === "admin" || role === "supervisor";
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
    if (!canReadServerAudit) {
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
        (r.items || []).map((it) => {
          let byFromPayload = "";
          let byEmailFromPayload = "";
          try {
            const payload = typeof it.payload_json === "string" ? JSON.parse(it.payload_json) : it.payload_json;
            byFromPayload = payload?.extra?.by || payload?.by || payload?.actor_name || "";
            byEmailFromPayload = payload?.extra?.byEmail || payload?.byEmail || "";
          } catch {
            byFromPayload = "";
            byEmailFromPayload = "";
          }
          const actorShort = it.actor_sub ? String(it.actor_sub).slice(0, 8) : "";
          return {
            id: `d1seq_${it.seq}`,
            at: it.created_at,
            action: it.action,
            entity: it.entity,
            detail: it.detail || "",
            by: byFromPayload || (actorShort ? `user ${actorShort}…` : ""),
            byEmail: byEmailFromPayload || "",
            byUserId: it.actor_sub || "",
            source: "server",
            seq: it.seq,
            clientRowId: it.client_row_id || null,
          };
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [bump, supabase, canReadServerAudit]);

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
  const [opsBump, setOpsBump] = useState(0);
  const opsRows = useMemo(() => readOpsLog(), [bump, opsBump]);
  const pageRows = useMemo(() => rows.slice(0, visible), [rows, visible]);
  const listWin = useListWindow(pageRows, { rowHeight: 56, maxHeight: 480, overscan: 4 });

  const refresh = () => {
    setVisible(AUDIT_PAGE);
    listWin.onScrollReset();
    setBump((x) => x + 1);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="LOG"
        title="Audit log"
        lead="Local activity log plus optional cloud copy. Technical diagnostics captures console and runtime errors for support — export if something breaks."
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
      {!canReadServerAudit && isD1Configured() ? (
        <div style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 10 }}>
          Server audit: your role is <strong>{role}</strong> — only organisation admins and supervisors can load the cloud audit list. Local entries below still apply.
        </div>
      ) : null}
      {serverStatus === "loading" ? (
        <div style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 10 }}>Loading server audit…</div>
      ) : null}
      {serverError && serverError !== "d1_not_configured" ? (
        <div style={{ color: "#b45309", fontSize: 13, marginBottom: 10 }}>
          Server audit:{" "}
          {String(serverError).includes("Forbidden") || String(serverError).includes("supervisor")
            ? "You need admin or supervisor role in this organisation to read the cloud audit log."
            : serverError}
        </div>
      ) : null}

      <div style={ss.card}>
        {rows.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No audit entries yet"
            description="Local and cloud activity will show here as your team works in MySafeOps."
            variant="dashed"
            compact
          />
        ) : (
          <div>
            <div
              ref={listWin.parentRef}
              style={{ maxHeight: listWin.maxHeight, overflow: "auto" }}
            >
              {listWin.enabled ? (
                <div style={{ height: listWin.totalHeight, position: "relative" }}>
                  <div style={{ position: "absolute", top: listWin.offsetY, left: 0, right: 0 }}>
                    {listWin.visibleItems.map((r) => (
                      <AuditRow key={r.id} r={r} rowHeight={listWin.rowHeight} />
                    ))}
                  </div>
                </div>
              ) : (
                listWin.visibleItems.map((r) => <AuditRow key={r.id} r={r} />)
              )}
            </div>
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

      <h3 style={{ margin: "24px 0 8px", fontSize: 16 }}>Diagnostics (errors &amp; auto-heal)</h3>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.45, maxWidth: 720 }}>
        When something fails in the browser, MySafeOps saves it here and (if configured) sends it to Sentry. Chunk-load
        errors trigger one automatic reload. For email alerts, enable Sentry in production with{" "}
        <code>VITE_SENTRY_DSN</code>.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" style={ss.btn} onClick={() => setOpsBump((x) => x + 1)}>
          Refresh diagnostics
        </button>
        <button
          type="button"
          style={ss.btn}
          onClick={() => {
            const blob = new Blob([exportOpsLogJson()], { type: "application/json;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `mysafeops-diagnostics-${todayLocalISO()}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Export JSON
        </button>
        {caps.backupImport ? (
          <button
            type="button"
            style={{ ...ss.btn, color: "#A32D2D", borderColor: "#F09595" }}
            onClick={() => {
              if (confirm("Clear diagnostics log for this organisation in this browser?")) {
                clearOpsLog();
                setOpsBump((x) => x + 1);
              }
            }}
          >
            Clear diagnostics
          </button>
        ) : null}
      </div>
      <div style={ss.card}>
        {opsRows.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>No technical errors recorded yet.</div>
        ) : (
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            {opsRows.slice(0, 40).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                  fontSize: 12,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                  {new Date(r.at).toLocaleString("en-GB")} · {r.level} · {r.source}
                  {r.healAction ? ` · heal: ${r.healAction}` : ""}
                </div>
                <div style={{ marginTop: 4, wordBreak: "break-word" }}>{r.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ r, rowHeight }) {
  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
        fontSize: 13,
        minHeight: rowHeight || undefined,
        contentVisibility: "auto",
        containIntrinsicSize: "0 52px",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
        {new Date(r.at).toLocaleString("en-GB")}
        {r.by || r.byEmail ? ` · ${formatActorLabel({ name: r.by, email: r.byEmail }) || r.by}` : ""}
      </div>
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
  );
}
