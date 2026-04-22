import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collectBackupBundle, restoreBackupBundle, validateBackupBundle } from "../utils/backup";
import { pushAudit } from "../utils/auditLog";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  downloadBackupFromSupabase,
  formatCloudSyncError,
  getCloudBackupMeta,
  uploadBackupToSupabase,
} from "../utils/cloudSync";
import { formatBytes, getEffectivePlan } from "../lib/billingPlans";
import { isSuperAdminEmail } from "../utils/superAdmin";
import { syncOrgSlugIfNeeded } from "../utils/orgMembership";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";

const ss = ms;

export default function BackupExport() {
  const { caps, orgId, trialStatus, billing } = useApp();
  const { supabase, user, ready } = useSupabaseAuth();
  const [msg, setMsg] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudUpdated, setCloudUpdated] = useState(null);
  const [includeGeocodeCache, setIncludeGeocodeCache] = useState(false);
  const fileRef = useRef(null);

  const cloudEnabled = isSupabaseConfigured() && supabase;
  const plan = getEffectivePlan(trialStatus, billing, { isPlatformOwner: isSuperAdminEmail(user?.email) });

  useEffect(() => {
    if (!cloudEnabled || !user || !ready) {
      setCloudUpdated(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const slug = await syncOrgSlugIfNeeded(supabase);
      if (cancelled) return;
      getCloudBackupMeta(supabase, slug).then((t) => {
        if (!cancelled) setCloudUpdated(t);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, user, ready, supabase, orgId]);

  const refreshCloudMeta = () => {
    if (!cloudEnabled || !user) return;
    (async () => {
      const slug = await syncOrgSlugIfNeeded(supabase);
      getCloudBackupMeta(supabase, slug).then(setCloudUpdated);
    })();
  };

  const download = () => {
    const bundle = collectBackupBundle({ includeGeocodeCache });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mysafeops-backup-${orgId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    const detail = `${Object.keys(bundle.keys).length} keys${includeGeocodeCache ? " + geocode cache" : ""}`;
    pushAudit({ action: "backup_export", entity: "all", detail });
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
        const v = validateBackupBundle(bundle);
        if (!v.ok) {
          setMsg(v.message);
          return;
        }
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
        const v = validateBackupBundle(bundle);
        if (!v.ok) {
          setMsg(v.message);
          return;
        }
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

  const uploadCloud = async () => {
    if (!cloudEnabled || !user) return;
    setMsg("");
    setCloudBusy(true);
    try {
      const bundle = collectBackupBundle({ includeGeocodeCache });
      const v = validateBackupBundle(bundle);
      if (!v.ok) {
        setMsg(v.message);
        return;
      }
      const bytes = new Blob([JSON.stringify(bundle)]).size;
      if (bytes > plan.limits.cloudBytes) {
        setMsg(
          `Cloud backup limit exceeded for ${plan.name}. Current backup is about ${formatBytes(bytes)}; limit is ${formatBytes(plan.limits.cloudBytes)}.`
        );
        return;
      }
      if (bytes > 4_000_000) {
        const mb = (bytes / 1_000_000).toFixed(1);
        if (!window.confirm(`Backup is about ${mb} MB. Cloud upload may be slow or fail. Continue?`)) {
          return;
        }
      }
      const slug = await syncOrgSlugIfNeeded(supabase);
      await uploadBackupToSupabase(supabase, slug, { bundle });
      pushAudit({ action: "backup_cloud_upload", entity: "all", detail: slug });
      setMsg("Cloud backup updated.");
      refreshCloudMeta();
    } catch (e) {
      setMsg(formatCloudSyncError(e));
    } finally {
      setCloudBusy(false);
    }
  };

  const downloadCloud = async (merge) => {
    if (!cloudEnabled || !user || !caps.backupImport) return;
    setMsg("");
    setCloudBusy(true);
    try {
      const slug = await syncOrgSlugIfNeeded(supabase);
      const r = await downloadBackupFromSupabase(supabase, slug, { merge });
      if (!r.skipped) {
        pushAudit({
          action: merge ? "backup_cloud_merge" : "backup_cloud_restore",
          entity: "all",
          detail: `${r.applied} keys`,
        });
        setMsg(
          merge
            ? `Merged ${r.applied} keys from cloud.`
            : `Restored ${r.applied} keys from cloud. Reload recommended.`
        );
      } else setMsg("Restore cancelled.");
    } catch (e) {
      setMsg(formatCloudSyncError(e));
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="BU"
        title="Backup & restore"
        lead="Export all organisation-scoped data and global settings to JSON. With Supabase, upload or download the same bundle after signing in under Settings."
      />
      {cloudEnabled && (
        <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
          <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 10, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
            Cloud backup (Supabase)
          </div>
          {!user ? (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
              Sign in under Settings to upload or download backups from the cloud.
            </p>
          ) : (
            <>
              {cloudUpdated && (
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
                  Last cloud backup: {new Date(cloudUpdated).toLocaleString()}
                </p>
              )}
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
                Plan: <strong>{plan.name}</strong> · Cloud limit: {formatBytes(plan.limits.cloudBytes)}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <button type="button" style={ss.btnP} disabled={cloudBusy} onClick={uploadCloud}>
                  Upload to cloud
                </button>
                {caps.backupImport ? (
                  <>
                    <button type="button" style={ss.btn} disabled={cloudBusy} onClick={() => downloadCloud(false)}>
                      Replace from cloud
                    </button>
                    <button type="button" style={ss.btn} disabled={cloudBusy} onClick={() => downloadCloud(true)}>
                      Merge from cloud
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                    Only administrators can restore or merge from cloud.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 10, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          Export
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, margin: "0 0 12px", maxWidth: 580 }}>
          Downloaded files may include <strong>personal data</strong> (for example about workers or site teams). In the UK, data protection law
          is the <strong>UK GDPR</strong> together with the <strong>Data Protection Act 2018</strong> (the post-Brexit UK regime, aligned with
          the same core principles as the EU GDPR, but with UK-specific rules). Your organisation is usually the <strong>data controller</strong>{" "}
          for operational data you enter; only export, share, and store backups where you have a <strong>lawful basis</strong> and appropriate
          safeguards. For how MySafeOps processes data as a provider, see the{" "}
          <Link to="/privacy" style={{ color: "var(--color-link, #0d9488)", fontWeight: 600 }}>
            Privacy policy
          </Link>
          .
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 13,
            color: "var(--color-text-secondary)",
            marginBottom: 12,
            cursor: "pointer",
            maxWidth: 520,
            lineHeight: 1.45,
          }}
        >
          <input
            type="checkbox"
            checked={includeGeocodeCache}
            onChange={(e) => setIncludeGeocodeCache(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <span>
            Include geocode cache (shared across organisations on this browser). Speeds up map geocoding after
            restore; optional.
          </span>
        </label>
        <button type="button" style={ss.btnP} onClick={download}>
          Download JSON backup
        </button>
      </div>
      <div className="app-surface-card" style={ss.card}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 10, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          Import
        </div>
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
