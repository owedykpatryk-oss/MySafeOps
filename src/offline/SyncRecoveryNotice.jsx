import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { D1_OUTBOX_CHANGED_EVENT, d1OutboxRecoveryForWorkspace } from "../lib/d1SyncOutbox";
import { isD1Configured } from "../lib/d1SyncClient";
import { getOrgId, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import { COUNTRY_WORKSPACE_CHANGED_EVENT, getCachedActiveCountryWorkspace } from "../utils/countryWorkspaces";
import { downloadBlob } from "../utils/downloadBlob";
import { ms } from "../utils/moduleStyles";

function currentScope() {
  const org = getOrgId();
  const country = getCachedActiveCountryWorkspace();
  const countryId = country?.is_primary ? null : country?.id || null;
  return { org, countryId, key: `${org}|${countryId || "primary"}` };
}

export default function SyncRecoveryNotice() {
  const [snapshot, setSnapshot] = useState({ key: "", rows: [], error: "" });
  const [dismissedKey, setDismissedKey] = useState(null);
  useEffect(() => {
    if (!isD1Configured()) return undefined;
    let disposed = false;
    let request = 0;
    const refresh = async () => {
      const scope = currentScope();
      const sequence = ++request;
      setSnapshot((prev) => prev.key === scope.key ? prev : { key: scope.key, rows: [], error: "" });
      if (!scope.org || scope.org === "default") return;
      try {
        const rows = await d1OutboxRecoveryForWorkspace(scope.org, scope.countryId);
        if (!disposed && sequence === request && currentScope().key === scope.key) {
          setSnapshot({ key: scope.key, rows, error: "" });
        }
      } catch {
        if (!disposed && sequence === request && currentScope().key === scope.key) {
          setSnapshot((prev) => ({ ...prev, error: "Recovery copies could not be read. Try again when device storage is available." }));
        }
      }
    };
    void refresh();
    const events = [D1_OUTBOX_CHANGED_EVENT, ORG_CHANGED_EVENT, COUNTRY_WORKSPACE_CHANGED_EVENT, "focus"];
    events.forEach((event) => window.addEventListener(event, refresh));
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      disposed = true;
      request++;
      events.forEach((event) => window.removeEventListener(event, refresh));
      window.clearInterval(timer);
    };
  }, []);

  if (!isD1Configured() || snapshot.key !== currentScope().key || (!snapshot.rows.length && !snapshot.error)) return null;
  // Dismiss only the copies already seen, in this workspace. A new conflict or
  // storage error must become visible even if the number of copies is unchanged.
  const noticeKey = JSON.stringify([
    snapshot.key,
    snapshot.error,
    snapshot.rows.map((row) => JSON.stringify([row.id, row.recoveredAt, row.serverVersion])).sort(),
  ]);
  if (dismissedKey === noticeKey) {
    return (
      <div style={{ marginBottom: 12 }}>
        <button type="button" style={{ ...ms.btn, fontSize: 12 }} onClick={() => setDismissedKey(null)} aria-expanded="false">
          {snapshot.rows.length ? `Show recovery copies (${snapshot.rows.length})` : "Show sync recovery notice"}
        </button>
      </div>
    );
  }
  const download = () => {
    if (snapshot.key !== currentScope().key || !snapshot.rows.length) return;
    const data = { format: "mysafeops-sync-recovery", version: 1, exportedAt: new Date().toISOString(), records: snapshot.rows };
    const ok = downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "mysafeops-sync-recovery.json");
    if (!ok) setSnapshot((prev) => ({ ...prev, error: "The download could not start. Your recovery copies are still saved on this device." }));
  };
  return (
    <div role="status" aria-live="polite" className="app-panel-surface" style={{ padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {snapshot.rows.length > 0 && <>
        <strong>Sync recovery copies available ({snapshot.rows.length})</strong>
        <p>A cloud version conflicted with changes on this device. Both versions were saved for review. Sync for affected lists is paused until the conflict is resolved. Download the recovery copies before clearing device data. Downloading does not restore or overwrite any records.</p>
        <button type="button" onClick={download} style={{ minHeight: 44 }}>Download recovery copies</button>
      </>}
      {snapshot.error && <p role="alert">{snapshot.error}</p>}
      </div>
      <button
        type="button"
        onClick={() => setDismissedKey(noticeKey)}
        aria-label="Dismiss sync recovery notice"
        title="Hide notice. Recovery copies are kept."
        style={{ ...ms.btn, minWidth: 44, padding: 10, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
