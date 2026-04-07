import { useRef, useState } from "react";
import { collectBackupBundle, restoreBackupBundle } from "../utils/backup";
import { pushAudit } from "../utils/auditLog";
import { useApp } from "../context/AppContext";

const ss = {
  btn: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  btnP: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid #085041", background: "#0d9488", color: "#E1F5EE", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  card: { background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: "1.25rem" },
};

export default function BackupExport() {
  const { caps, orgId } = useApp();
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const download = () => {
    const bundle = collectBackupBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mysafeops-backup-${orgId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    pushAudit({ action: "backup_export", entity: "all", detail: `${Object.keys(bundle.keys).length} keys` });
    setMsg("Backup downloaded.");
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !caps.backupImport) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bundle = JSON.parse(reader.result);
        const r = restoreBackupBundle(bundle, { merge: false });
        if (!r.skipped) {
          pushAudit({ action: "backup_import", entity: "all", detail: `${r.applied} keys` });
          setMsg(`Restored ${r.applied} keys. Reload recommended.`);
        } else setMsg("Import cancelled.");
      } catch (err) {
        setMsg(err.message || "Invalid JSON");
      }
    };
    reader.readAsText(f);
  };

  const mergeFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !caps.backupImport) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bundle = JSON.parse(reader.result);
        const r = restoreBackupBundle(bundle, { merge: true });
        if (!r.skipped) {
          pushAudit({ action: "backup_merge", entity: "all", detail: `${r.applied} keys` });
          setMsg(`Merged ${r.applied} keys.`);
        } else setMsg("Merge cancelled.");
      } catch (err) {
        setMsg(err.message || "Invalid JSON");
      }
    };
    reader.readAsText(f);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <h2 style={{ fontWeight: 500, fontSize: 20, margin: "0 0 8px" }}>Backup & restore</h2>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 20 }}>
        Export all org-scoped data and global org settings to a JSON file. Restore replaces keys on this browser only — there is no cloud sync.
      </p>
      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Export</div>
        <button type="button" style={ss.btnP} onClick={download}>
          Download JSON backup
        </button>
      </div>
      <div style={ss.card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Import</div>
        {!caps.backupImport ? (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Only administrators can import backups.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" style={ss.btn} onClick={() => fileRef.current?.click()}>
                Replace from backup
              </button>
              <button type="button" style={ss.btn} onClick={() => document.getElementById("merge-backup").click()}>
                Merge backup
              </button>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onFile} />
            <input id="merge-backup" type="file" accept="application/json,.json" style={{ display: "none" }} onChange={mergeFile} />
          </>
        )}
      </div>
      {msg && <p style={{ marginTop: 16, fontSize: 13 }}>{msg}</p>}
    </div>
  );
}
