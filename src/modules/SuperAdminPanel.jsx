import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHero from "../components/PageHero";
import { ms } from "../utils/moduleStyles";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useApp } from "../context/AppContext";
import { isSuperAdminEmail, SUPERADMIN_EMAIL } from "../utils/superAdmin";
import { isSupabaseConfigured } from "../lib/supabase";
import { isR2StorageConfigured } from "../lib/r2Storage";
import {
  getDisplayAppVersion,
  getSupabaseDashboardProjectUrl,
  getSupabaseProjectRef,
  getViteMode,
} from "../utils/appBuildInfo";
import { isAnthropicConfigured } from "../utils/anthropicClient";

const ss = ms;
/** SQL files that define owner-only RPCs used by this page (copy into Supabase / CLI). */
const SUPERADMIN_DB_MIGRATIONS = [
  "20260420160000_superadmin_platform_stats.sql",
  "20260420180000_superadmin_platform_stats_extend.sql",
  "20260420190000_superadmin_recent_orgs.sql",
];
const ORG_AUDIT_KEY_PREFIX = "mysafeops_audit_";

const MODULE_KEY_MAP = [
  { label: "Permits", key: "permits_v2" },
  { label: "RAMS", key: "rams_builder_docs" },
  { label: "Workers", key: "mysafeops_workers" },
  { label: "Projects", key: "mysafeops_projects" },
  { label: "Snags", key: "snags" },
  { label: "Incidents", key: "mysafeops_incidents" },
  { label: "Timesheets", key: "mysafeops_timesheets" },
  { label: "Training", key: "training_matrix" },
  { label: "Inspections", key: "inspection_records" },
  { label: "Visitors", key: "visitor_log" },
];

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function extractOrgIdFromKey(storageKey) {
  const i = storageKey.lastIndexOf("_");
  if (i < 0) return "";
  return storageKey.slice(i + 1);
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toCsvLine(cols) {
  return cols.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function shortUserId(id) {
  if (!id) return "—";
  const s = String(id);
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function fmtIsoShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

function readLocalOrgUsage() {
  const orgIds = new Set();
  const moduleTotals = Object.fromEntries(MODULE_KEY_MAP.map((m) => [m.label, 0]));
  const actionCounts = {};
  const latestByOrg = {};
  const unscopedKeys = [];
  let totalAuditEvents = 0;

  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (!k) continue;
    const raw = localStorage.getItem(k);
    if (raw == null) continue;

    if (k.startsWith(ORG_AUDIT_KEY_PREFIX)) {
      const orgId = extractOrgIdFromKey(k);
      if (orgId) orgIds.add(orgId);
      const rows = parseJson(raw, []);
      if (!Array.isArray(rows)) continue;
      totalAuditEvents += rows.length;
      rows.forEach((row) => {
        const action = String(row?.action || "other").trim().toLowerCase();
        actionCounts[action] = toNum(actionCounts[action]) + 1;
        const at = row?.at ? Date.parse(row.at) : NaN;
        if (Number.isFinite(at) && orgId) {
          latestByOrg[orgId] = Math.max(toNum(latestByOrg[orgId]), at);
        }
      });
      continue;
    }

    MODULE_KEY_MAP.forEach((m) => {
      if (k === m.key) unscopedKeys.push(k);
      const wantedPrefix = `${m.key}_`;
      if (!k.startsWith(wantedPrefix)) return;
      const orgId = extractOrgIdFromKey(k);
      if (orgId) orgIds.add(orgId);
      const arr = parseJson(raw, null);
      if (Array.isArray(arr)) {
        moduleTotals[m.label] += arr.length;
      } else if (arr && typeof arr === "object") {
        moduleTotals[m.label] += Object.keys(arr).length;
      }
    });
  }

  const now = Date.now();
  const active15m = Object.values(latestByOrg).filter((ts) => now - ts <= 15 * 60 * 1000).length;
  const active24h = Object.values(latestByOrg).filter((ts) => now - ts <= 24 * 60 * 60 * 1000).length;

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));

  const topModules = Object.entries(moduleTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([module, count]) => ({ module, count }));

  const moduleAdoption = MODULE_KEY_MAP.map((m) => {
    const count = toNum(moduleTotals[m.label]);
    const orgBase = Math.max(1, orgIds.size);
    return {
      module: m.label,
      count,
      avgPerOrg: Number((count / orgBase).toFixed(2)),
    };
  }).sort((a, b) => b.count - a.count);

  return {
    organisationsDetected: orgIds.size,
    activeOrg15m: active15m,
    activeOrg24h: active24h,
    totalAuditEvents,
    topActions,
    topModules,
    moduleAdoption,
    unscopedKeys,
  };
}

const EMPTY_LOCAL_ORG_USAGE = {
  organisationsDetected: 0,
  activeOrg15m: 0,
  activeOrg24h: 0,
  totalAuditEvents: 0,
  topActions: [],
  topModules: [],
  moduleAdoption: [],
  unscopedKeys: [],
};

/**
 * Cross-tenant metrics via SECURITY DEFINER RPC (only succeeds for mysafeops@gmail.com).
 * Apply migration: supabase/migrations/20260420160000_superadmin_platform_stats.sql
 */
async function readCloudSummary(supabase) {
  if (!supabase) return { ok: false, message: "Cloud database not configured." };
  try {
    const { data, error } = await supabase.rpc("superadmin_platform_stats");
    if (error) throw error;
    if (!data || data.ok === false) {
      const reason = data?.error === "forbidden" ? "Forbidden (sign in as platform owner)." : String(data?.error || "forbidden");
      return { ok: false, fetchedAt: new Date().toISOString(), message: reason };
    }
    const subsObj = data.subscriptions && typeof data.subscriptions === "object" ? data.subscriptions : {};
    const plansObj = data.plans && typeof data.plans === "object" ? data.plans : {};
    const subscriptions = Object.entries(subsObj).sort((a, b) => toNum(b[1]) - toNum(a[1]));
    const plans = Object.entries(plansObj).sort((a, b) => toNum(b[1]) - toNum(a[1]));
    const registrationsTrend = Array.isArray(data.registrations_trend) ? data.registrations_trend : [];
    const ext = (k) => (data[k] !== undefined && data[k] !== null ? toNum(data[k]) : null);
    return {
      ok: true,
      fetchedAt: data.fetched_at || new Date().toISOString(),
      totalOrganisations: toNum(data.total_organisations),
      organisations30d: toNum(data.organisations_30d),
      totalMembers: toNum(data.total_memberships),
      newMembers7d: toNum(data.new_memberships_7d),
      orgsWithStripeCustomer: toNum(data.orgs_with_stripe_customer),
      paidCount: toNum(data.paid_org_count),
      trialingOrgCount: ext("trialing_org_count"),
      pastDueOrUnpaidOrgCount: ext("past_due_or_unpaid_org_count"),
      orgsWithZeroMembers: ext("orgs_with_zero_members"),
      pendingInvites: ext("pending_invites"),
      registrationsTrend,
      subscriptions,
      plans,
    };
  } catch (err) {
    const code = err?.code ? ` [${err.code}]` : "";
    const msg = `${err?.message || "Cloud summary not available."}${code}`;
    const hint =
      String(msg).includes("superadmin_platform_stats") || String(msg).includes("function")
        ? `${msg} — deploy migrations: ${SUPERADMIN_DB_MIGRATIONS.join(", ")} on Supabase.`
        : msg;
    return { ok: false, fetchedAt: new Date().toISOString(), message: hint, errorCode: err?.code || null };
  }
}

/**
 * Latest organisations (limited rows) — SECURITY DEFINER RPC, owner email only.
 * Migration: supabase/migrations/20260420190000_superadmin_recent_orgs.sql
 */
async function readRecentOrganisations(supabase) {
  if (!supabase) return { ok: false, message: "Cloud database not configured.", rows: [] };
  try {
    const { data, error } = await supabase.rpc("superadmin_recent_organisations", { p_limit: 50 });
    if (error) throw error;
    if (!data || data.ok === false) {
      const reason = data?.error === "forbidden" ? "Forbidden (sign in as platform owner)." : String(data?.error || "forbidden");
      return { ok: false, fetchedAt: new Date().toISOString(), message: reason, rows: [] };
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return { ok: true, rows, fetchedAt: data.fetched_at || new Date().toISOString(), message: "" };
  } catch (err) {
    const code = err?.code ? ` [${err.code}]` : "";
    const msg = `${err?.message || "Recent organisations not available."}${code}`;
    const hint =
      String(msg).includes("superadmin_recent_organisations") || String(msg).includes("function")
        ? `${msg} — deploy ${SUPERADMIN_DB_MIGRATIONS[2]} (or all: ${SUPERADMIN_DB_MIGRATIONS.join(", ")}).`
        : msg;
    return { ok: false, fetchedAt: new Date().toISOString(), message: hint, rows: [], errorCode: err?.code || null };
  }
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ ...ss.card, marginBottom: 0 }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function MiniBars({ rows }) {
  if (!rows?.length) return <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>No data.</div>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minHeight: 100 }}>
      {rows.map((row) => (
        <div key={row.key || row.label} style={{ flex: 1, textAlign: "center" }}>
          <div
            title={`${row.label}: ${row.count}`}
            style={{
              width: "100%",
              height: `${Math.max(4, (row.count / max) * 80)}px`,
              borderRadius: "8px 8px 4px 4px",
              background: "#0d9488",
              marginBottom: 4,
            }}
          />
          <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{row.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function SuperAdminPanel() {
  const { user, supabase } = useSupabaseAuth();
  const { billing, trialStatus } = useApp();
  const [cloud, setCloud] = useState({ ok: false, message: "Loading..." });
  const [recentOrgs, setRecentOrgs] = useState({ ok: false, message: "Loading…", rows: [] });
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [showAllModules, setShowAllModules] = useState(false);
  const [copyHint, setCopyHint] = useState("");
  const copyTimerRef = useRef(null);
  const cloudFetchSeq = useRef(0);
  const allowed = isSuperAdminEmail(user?.email);

  const flashCopy = (label) => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopyHint(label);
    copyTimerRef.current = setTimeout(() => {
      setCopyHint("");
      copyTimerRef.current = null;
    }, 2200);
  };

  const fetchCloud = useCallback(() => {
    if (!allowed) return;
    const seq = ++cloudFetchSeq.current;
    setLoadingCloud(true);
    Promise.all([readCloudSummary(supabase), readRecentOrganisations(supabase)]).then(([stats, recent]) => {
      if (seq !== cloudFetchSeq.current) return;
      setCloud(stats);
      setRecentOrgs(recent);
      setLoadingCloud(false);
    });
  }, [allowed, supabase]);
  const localSummary = useMemo(() => (allowed ? readLocalOrgUsage() : EMPTY_LOCAL_ORG_USAGE), [allowed, localRefreshKey]);
  const supabaseDashboardUrl = useMemo(() => getSupabaseDashboardProjectUrl(), []);
  const supabaseProjectRef = useMemo(() => getSupabaseProjectRef(), []);
  const publicSiteOrigin = useMemo(
    () => String(import.meta.env.VITE_PUBLIC_SITE_URL || "").trim().replace(/\/$/, ""),
    []
  );
  const buildVersion = useMemo(() => getDisplayAppVersion(), []);
  const viteMode = useMemo(() => getViteMode(), []);
  const aiKeyConfigured = useMemo(() => isAnthropicConfigured(), []);

  useEffect(() => {
    fetchCloud();
    return () => {
      cloudFetchSeq.current += 1;
    };
  }, [fetchCloud]);

  const cloudPaidPct =
    cloud.ok && cloud.totalOrganisations > 0 ? `${Math.round((cloud.paidCount / cloud.totalOrganisations) * 100)}%` : "—";
  const activeRatio =
    localSummary.organisationsDetected > 0
      ? `${Math.round((localSummary.activeOrg24h / localSummary.organisationsDetected) * 100)}%`
      : "0%";

  const exportSnapshotJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      generatedBy: user?.email || "",
      meta: {
        appVersion: buildVersion,
        viteMode,
        supabaseProjectRef: supabaseProjectRef || null,
        supabaseClientConfigured: isSupabaseConfigured(),
        r2StorageConfigured: isR2StorageConfigured(),
        anthropicKeyConfigured: aiKeyConfigured,
      },
      localSummary,
      cloudSummary: cloud,
      recentOrganisations: recentOrgs,
      cloudExtended:
        cloud.ok
          ? {
              trialingOrgCount: cloud.trialingOrgCount,
              pastDueOrUnpaidOrgCount: cloud.pastDueOrUnpaidOrgCount,
              orgsWithZeroMembers: cloud.orgsWithZeroMembers,
              pendingInvites: cloud.pendingInvites,
            }
          : null,
    };
    downloadFile(`mysafeops-superadmin-snapshot-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const exportSnapshotCsv = () => {
    const lines = [];
    lines.push(toCsvLine(["section", "metric", "value"]));
    lines.push(toCsvLine(["overview", "organisations_detected_device", localSummary.organisationsDetected]));
    lines.push(toCsvLine(["overview", "active_org_15m", localSummary.activeOrg15m]));
    lines.push(toCsvLine(["overview", "active_org_24h", localSummary.activeOrg24h]));
    lines.push(toCsvLine(["overview", "active_org_ratio", activeRatio]));
    lines.push(toCsvLine(["overview", "total_audit_events", localSummary.totalAuditEvents]));
    lines.push(toCsvLine(["meta", "app_version", buildVersion]));
    lines.push(toCsvLine(["meta", "vite_mode", viteMode]));
    lines.push(toCsvLine(["meta", "supabase_project_ref", supabaseProjectRef || ""]));
    lines.push(toCsvLine(["meta", "supabase_client_configured", isSupabaseConfigured() ? "yes" : "no"]));
    lines.push(toCsvLine(["meta", "r2_storage_configured", isR2StorageConfigured() ? "yes" : "no"]));
    lines.push(toCsvLine(["meta", "anthropic_key_configured", aiKeyConfigured ? "yes" : "no"]));
    if (cloud.ok) {
      lines.push(toCsvLine(["cloud", "total_organisations", cloud.totalOrganisations]));
      lines.push(toCsvLine(["cloud", "new_organisations_30d", cloud.organisations30d]));
      lines.push(toCsvLine(["cloud", "total_memberships", cloud.totalMembers ?? ""]));
      lines.push(toCsvLine(["cloud", "new_memberships_7d", cloud.newMembers7d ?? ""]));
      lines.push(toCsvLine(["cloud", "orgs_with_stripe_customer", cloud.orgsWithStripeCustomer ?? ""]));
      lines.push(toCsvLine(["cloud", "paid_conversion", cloudPaidPct]));
      if (cloud.trialingOrgCount != null) lines.push(toCsvLine(["cloud", "trialing_orgs", cloud.trialingOrgCount]));
      if (cloud.pastDueOrUnpaidOrgCount != null) lines.push(toCsvLine(["cloud", "past_due_or_unpaid_orgs", cloud.pastDueOrUnpaidOrgCount]));
      if (cloud.orgsWithZeroMembers != null) lines.push(toCsvLine(["cloud", "orgs_zero_members", cloud.orgsWithZeroMembers]));
      if (cloud.pendingInvites != null) lines.push(toCsvLine(["cloud", "pending_invites", cloud.pendingInvites]));
      (cloud.plans || []).forEach(([plan, count]) => lines.push(toCsvLine(["plan", plan, count])));
      (cloud.subscriptions || []).forEach(([status, count]) => lines.push(toCsvLine(["subscription", status, count])));
      (cloud.registrationsTrend || []).forEach((row) =>
        lines.push(toCsvLine(["registrations_trend", row.key || row.label || "", row.count ?? ""]))
      );
    }
    if (recentOrgs.ok && Array.isArray(recentOrgs.rows)) {
      recentOrgs.rows.forEach((r) =>
        lines.push(
          toCsvLine([
            "recent_org",
            r.slug || "",
            r.name || "",
            r.created_at || "",
            r.billing_plan || "",
            r.subscription_status || "",
            r.has_stripe ? "yes" : "no",
          ])
        )
      );
    }
    localSummary.topModules.forEach((m) => lines.push(toCsvLine(["top_module", m.module, m.count])));
    localSummary.topActions.forEach((a) => lines.push(toCsvLine(["top_action", a.action, a.count])));
    downloadFile(`mysafeops-superadmin-snapshot-${new Date().toISOString().slice(0, 10)}.csv`, `${lines.join("\n")}\n`, "text/csv");
  };

  if (!allowed) {
    return (
      <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0" }}>
        <PageHero badgeText="SA" title="Owner dashboard" lead="Restricted to the platform owner account only." />
        <div style={ss.card}>This page is not available for your account.</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0" }}>
      <PageHero
        badgeText="SA"
        title="Platform owner dashboard"
        lead={`Signed in as ${SUPERADMIN_EMAIL}. Cross-organisation metrics (aggregates). Not visible to any other user.`}
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {copyHint ? (
              <span style={{ fontSize: 12, color: "#0f766e", fontWeight: 600 }} aria-live="polite">
                {copyHint}
              </span>
            ) : null}
            <button type="button" onClick={() => setLocalRefreshKey((x) => x + 1)} style={ss.btn}>
              Refresh local
            </button>
            <button type="button" onClick={fetchCloud} style={ss.btn} disabled={loadingCloud}>
              Refresh cloud
            </button>
            <button type="button" onClick={exportSnapshotJson} style={ss.btn}>
              Export JSON
            </button>
            <button type="button" onClick={exportSnapshotCsv} style={ss.btn}>
              Export CSV
            </button>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px,100%), 1fr))", gap: 12, marginBottom: 14 }}>
        <div style={ss.card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>This browser build</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            <div>
              Version <strong style={{ color: "var(--color-text-primary)" }}>{buildVersion}</strong>
              {" · "}
              Vite mode <strong style={{ color: "var(--color-text-primary)" }}>{viteMode}</strong>
              {import.meta.env.DEV ? " (dev)" : ""}
            </div>
            <div style={{ marginTop: 10, fontWeight: 600, color: "var(--color-text-primary)", fontSize: 12 }}>Quick links</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.75 }}>
              {supabaseDashboardUrl ? (
                <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <a href={supabaseDashboardUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0d9488" }}>
                    Supabase project dashboard
                  </a>
                  {supabaseProjectRef ? (
                    <>
                      <code style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, background: "var(--color-background-secondary,#f5f5f5)" }}>
                        {supabaseProjectRef}
                      </code>
                      <button
                        type="button"
                        style={{ ...ss.btn, padding: "4px 10px", fontSize: 12 }}
                        title="Copy Supabase project ref"
                        onClick={() => {
                          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(supabaseProjectRef).then(() => flashCopy("Project ref copied")).catch(() => {});
                          }
                        }}
                      >
                        Copy ref
                      </button>
                    </>
                  ) : null}
                </li>
              ) : (
                <li style={{ color: "var(--color-text-secondary)" }}>Supabase: set VITE_SUPABASE_URL to enable dashboard link.</li>
              )}
              <li>
                <a href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#0d9488" }}>
                  Stripe Dashboard
                </a>
              </li>
              {publicSiteOrigin ? (
                <li>
                  <a href={publicSiteOrigin} target="_blank" rel="noopener noreferrer" style={{ color: "#0d9488" }}>
                    Public site (VITE_PUBLIC_SITE_URL)
                  </a>
                </li>
              ) : null}
            </ul>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              Signed-in user id (for support logs):{" "}
              <code style={{ fontSize: 11 }} title={user?.id || ""}>
                {shortUserId(user?.id)}
              </code>
              {user?.id ? (
                <button
                  type="button"
                  style={{ ...ss.btn, padding: "4px 10px", fontSize: 12 }}
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(user.id).then(() => flashCopy("User id copied")).catch(() => {});
                    }
                  }}
                >
                  Copy full id
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div style={ss.card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>How to read these metrics</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.65 }}>
            <li>
              <strong style={{ color: "var(--color-text-primary)" }}>Device (local)</strong> counts come from this browser&apos;s{" "}
              <code style={{ fontSize: 11 }}>localStorage</code> (org-scoped module keys and audit trail). They reflect orgs and volumes{" "}
              <em>this profile has used on this machine</em>, not global monthly active users.
            </li>
            <li style={{ marginTop: 8 }}>
              <strong style={{ color: "var(--color-text-primary)" }}>Cloud (RPC)</strong> aggregates are from{" "}
              <code style={{ fontSize: 11 }}>superadmin_platform_stats</code> in Supabase — whole platform, gated to your owner email only.
            </li>
            <li style={{ marginTop: 8 }}>
              <strong style={{ color: "var(--color-text-primary)" }}>Paid conversion</strong> is paying orgs / all orgs: plan in starter / team / business with
              subscription status active or trialing.
            </li>
          </ul>
        </div>
      </div>

      <div style={{ ...ss.card, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Client integrations (this deploy)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { ok: isSupabaseConfigured(), label: "Supabase client (URL + anon key)" },
            { ok: isR2StorageConfigured(), label: "R2 upload worker (VITE_STORAGE_API_URL)" },
            { ok: aiKeyConfigured, label: "Anthropic AI (VITE key or VITE_ANTHROPIC_PROXY_URL)" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 8,
                background: row.ok ? "#ecfeff" : "#fafafa",
                color: row.ok ? "#0e7490" : "var(--color-text-secondary)",
                border: `1px solid ${row.ok ? "#a5f3fc" : "var(--color-border-tertiary,#e5e5e5)"}`,
                maxWidth: "100%",
              }}
            >
              {row.ok ? "✓ " : "○ "}
              {row.label}
            </div>
          ))}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Flags reflect env vars baked into this bundle — not live remote health checks. Use Supabase / Stripe dashboards for service status.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 999,
            background: cloud.ok ? "#dcfce7" : "#ffedd5",
            color: cloud.ok ? "#166534" : "#9a3412",
            border: `1px solid ${cloud.ok ? "#86efac" : "#fdba74"}`,
          }}
        >
          Cloud RPC: {cloud.ok ? "OK" : loadingCloud ? "Loading…" : "Unavailable"}
        </div>
        {cloud.ok && toNum(cloud.pastDueOrUnpaidOrgCount) > 0 ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 999,
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fcd34d",
            }}
          >
            Billing: {cloud.pastDueOrUnpaidOrgCount} org(s) past_due or unpaid
          </div>
        ) : null}
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 999,
            background: localSummary.unscopedKeys.length ? "#fee2e2" : "#dcfce7",
            color: localSummary.unscopedKeys.length ? "#991b1b" : "#166534",
            border: `1px solid ${localSummary.unscopedKeys.length ? "#fecaca" : "#86efac"}`,
          }}
        >
          Legacy keys: {localSummary.unscopedKeys.length ? `${localSummary.unscopedKeys.length} issue(s)` : "None detected"}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 999,
            background: "#f5f5f5",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-tertiary,#e5e5e5)",
          }}
        >
          Orgs on device: {localSummary.organisationsDetected}
          {cloud.ok ? ` · Cloud orgs: ${cloud.totalOrganisations}` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px,100%), 1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Organisations seen (device)" value={localSummary.organisationsDetected} sub="From local org-scoped keys" />
        <StatCard label="Active orgs (15 min)" value={localSummary.activeOrg15m} sub="Based on latest audit activity" />
        <StatCard label="Active orgs (24h)" value={localSummary.activeOrg24h} sub={`Activity ratio: ${activeRatio}`} />
        <StatCard label="Audit events (device)" value={localSummary.totalAuditEvents} sub="All org-scoped audit rows" />
        <StatCard
          label="Cloud paid conversion"
          value={cloudPaidPct}
          sub={cloud.ok ? `${cloud.paidCount}/${cloud.totalOrganisations} paying orgs (active/trialing)` : "Cloud metrics unavailable"}
        />
        {cloud.ok ? (
          <>
            <StatCard label="New accounts (7d)" value={cloud.newMembers7d ?? "—"} sub="New org_memberships rows" />
            <StatCard label="Orgs with Stripe customer" value={cloud.orgsWithStripeCustomer ?? "—"} sub="Organisations with cus_… on file" />
            <StatCard
              label="New orgs (30d)"
              value={cloud.organisations30d ?? "—"}
              sub={
                toNum(cloud.organisations30d) === 0
                  ? "No new organisations in the last 30 days — check acquisition / onboarding."
                  : "Organisations created in the last 30 days"
              }
            />
            <StatCard
              label="Trialing (Stripe)"
              value={cloud.trialingOrgCount ?? "—"}
              sub={cloud.trialingOrgCount == null ? "Requires DB migration extend" : "Organisations on trialing status"}
            />
            <StatCard
              label="Past due / unpaid"
              value={cloud.pastDueOrUnpaidOrgCount ?? "—"}
              sub={
                cloud.pastDueOrUnpaidOrgCount == null
                  ? "Extended RPC only"
                  : toNum(cloud.pastDueOrUnpaidOrgCount) > 0
                    ? "Needs billing attention"
                    : "No billing risk flags"
              }
            />
            <StatCard
              label="Orgs with 0 members"
              value={cloud.orgsWithZeroMembers ?? "—"}
              sub={
                cloud.orgsWithZeroMembers == null
                  ? "Extended RPC only"
                  : toNum(cloud.orgsWithZeroMembers) > 0
                    ? "Data integrity — investigate in SQL"
                    : "All orgs have at least one membership"
              }
            />
            <StatCard
              label="Pending invites"
              value={cloud.pendingInvites ?? "—"}
              sub={cloud.pendingInvites == null ? "Requires DB migration extend" : "org_invites pending and not expired"}
            />
          </>
        ) : null}
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Subscription snapshot</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Current org status: <strong>{billing?.subscriptionStatus || "none"}</strong>
          {billing?.paidPlanId ? ` · Plan: ${billing.paidPlanId}` : ""}
          {trialStatus?.isActive ? ` · Trial: ${trialStatus.remainingDays} day(s) left` : ""}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Your login has <strong>unlimited</strong> workers / projects / storage in the billing UI. Open{" "}
          <strong>More → Billing &amp; limits</strong> for this organisation; use this dashboard for platform-wide numbers.
        </p>
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Platform cloud summary (Supabase RPC)</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            Last fetch: {cloud?.fetchedAt ? new Date(cloud.fetchedAt).toLocaleString() : "—"}
          </div>
        </div>
        {loadingCloud ? (
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Loading cloud metrics...</div>
        ) : cloud.ok ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13 }}>
              Registered organisations: <strong>{cloud.totalOrganisations}</strong> · New orgs in 30 days:{" "}
              <strong>{cloud.organisations30d}</strong>
              {cloud.totalMembers != null ? (
                <>
                  {" "}
                  · Total user memberships: <strong>{cloud.totalMembers}</strong>
                </>
              ) : null}
              {cloud.newMembers7d != null ? (
                <>
                  {" "}
                  · New memberships (7d): <strong>{cloud.newMembers7d}</strong>
                </>
              ) : null}
              {cloud.orgsWithStripeCustomer != null ? (
                <>
                  {" "}
                  · Orgs with Stripe customer id: <strong>{cloud.orgsWithStripeCustomer}</strong>
                </>
              ) : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Subscriptions</div>
                {(cloud.subscriptions || []).map(([name, count]) => (
                  <div key={`sub_${name}`} style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {name}: {count}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Plans</div>
                {(cloud.plans || []).map(([name, count]) => (
                  <div key={`plan_${name}`} style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {name}: {count}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Registration trend (last 6 months)</div>
              <MiniBars rows={cloud.registrationsTrend || []} />
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: "#7c2d12",
              background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
              border: "1px solid #fdba74",
              borderRadius: 10,
              padding: "12px 14px",
              lineHeight: 1.55,
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>Cloud metrics unavailable</strong>
            <span style={{ wordBreak: "break-word" }}>{cloud.message}</span>
            {cloud.errorCode ? (
              <div style={{ marginTop: 8, fontSize: 11, color: "#9a3412" }}>
                PostgREST / API code: <code style={{ fontSize: 10 }}>{String(cloud.errorCode)}</code>
              </div>
            ) : null}
            {(() => {
              const m = String(cloud.message || "").toLowerCase();
              const showMigration =
                m.includes("superadmin_platform_stats") ||
                m.includes("superadmin_recent_organisations") ||
                m.includes("function") ||
                m.includes("does not exist") ||
                m.includes("rpc");
              if (!showMigration || m.includes("forbidden")) return null;
              return (
                <>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {SUPERADMIN_DB_MIGRATIONS.map((m) => (
                      <code
                        key={m}
                        style={{
                          fontSize: 11,
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.85)",
                          border: "1px solid #fed7aa",
                          display: "block",
                          width: "fit-content",
                          maxWidth: "100%",
                          wordBreak: "break-all",
                        }}
                      >
                        supabase/migrations/{m}
                      </code>
                    ))}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        style={ss.btn}
                        title="Copy migration paths to clipboard"
                        onClick={() => {
                          const t = SUPERADMIN_DB_MIGRATIONS.map((m) => `supabase/migrations/${m}`).join("\n");
                          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(t).then(() => flashCopy("Migration paths copied")).catch(() => {});
                          }
                        }}
                      >
                        Copy paths
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9a3412" }}>
                    Run these migrations on your Supabase project (CLI <code style={{ fontSize: 10 }}>db push</code> or SQL Editor), then use Refresh cloud.
                  </p>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Recent organisations (Supabase RPC)</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            Last fetch: {recentOrgs?.fetchedAt ? new Date(recentOrgs.fetchedAt).toLocaleString() : "—"}
          </div>
        </div>
        {loadingCloud ? (
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Loading organisation list…</div>
        ) : recentOrgs.ok ? (
          recentOrgs.rows.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No organisations in the database yet.</div>
          ) : (
            <div style={{ overflow: "auto", maxHeight: 360, border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--color-background-secondary,#f7f7f5)", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Slug</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Name</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Created</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Plan</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Subscription</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Stripe</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrgs.rows.map((r) => (
                    <tr key={String(r.id || r.slug)} style={{ borderTop: "0.5px solid var(--color-border-tertiary,#eee)" }}>
                      <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>{r.slug || "—"}</td>
                      <td style={{ padding: "8px 10px", wordBreak: "break-word" }}>{r.name || "—"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "var(--color-text-secondary)" }}>{fmtIsoShort(r.created_at)}</td>
                      <td style={{ padding: "8px 10px" }}>{r.billing_plan || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{r.subscription_status || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{r.has_stripe ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div
            style={{
              fontSize: 13,
              color: "#7c2d12",
              background: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: 10,
              padding: "10px 12px",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>Recent organisations unavailable</strong>
            <span style={{ wordBreak: "break-word" }}>{recentOrgs.message}</span>
            {recentOrgs.errorCode ? (
              <div style={{ marginTop: 6, fontSize: 11, color: "#9a3412" }}>
                Code: <code style={{ fontSize: 10 }}>{String(recentOrgs.errorCode)}</code>
              </div>
            ) : null}
            {(() => {
              const m = String(recentOrgs.message || "").toLowerCase();
              const show =
                m.includes("superadmin_recent_organisations") || m.includes("function") || m.includes("does not exist") || m.includes("rpc");
              if (!show || m.includes("forbidden")) return null;
              return (
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9a3412" }}>
                  Deploy <code style={{ fontSize: 10 }}>supabase/migrations/{SUPERADMIN_DB_MIGRATIONS[2]}</code>, then Refresh cloud.
                </p>
              );
            })()}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={ss.card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Most used actions</div>
          {localSummary.topActions.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No tracked actions yet.</div>
          ) : (
            localSummary.topActions.map((row) => (
              <div key={row.action} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "4px 0" }}>
                {row.action}: <strong>{row.count}</strong>
              </div>
            ))
          )}
        </div>
        <div style={ss.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Module adoption (avg records/org)</div>
            {localSummary.moduleAdoption.length > 8 ? (
              <button type="button" style={{ ...ss.btn, padding: "6px 12px", fontSize: 12 }} onClick={() => setShowAllModules((v) => !v)}>
                {showAllModules ? "Show top 8" : `Show all (${localSummary.moduleAdoption.length})`}
              </button>
            ) : null}
          </div>
          {localSummary.moduleAdoption.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No local datasets detected.</div>
          ) : (
            (showAllModules ? localSummary.moduleAdoption : localSummary.moduleAdoption.slice(0, 8)).map((row) => (
              <div key={row.module} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "4px 0" }}>
                {row.module}: <strong>{row.count}</strong> total (avg {row.avgPerOrg}/org)
              </div>
            ))
          )}
        </div>
      </div>

      <div style={ss.card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Isolation and safety checks</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: 8 }}>
          Workspace modules use org-scoped storage keys (`baseKey_orgId`) and org context synced from Supabase (`ensure_my_org`).
          This keeps company A and company B data separated by organisation scope.
        </div>
        {localSummary.unscopedKeys.length > 0 ? (
          <div style={{ fontSize: 12, color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px" }}>
            Warning: detected legacy non-org-scoped keys: {Array.from(new Set(localSummary.unscopedKeys)).join(", ")}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#166534", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "8px 10px" }}>
            No legacy non-org-scoped data keys detected for tracked modules.
          </div>
        )}
      </div>

      <div style={ss.card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Before you ship (checklist)</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
          <li>Run pending Supabase migrations (including owner RPC) and smoke-test auth + one org workflow.</li>
          <li>Confirm Vercel env vars match <code style={{ fontSize: 11 }}>.env.local</code> for production and preview.</li>
          <li>Stripe: webhook signing secret and price IDs aligned with the billing doctor script if you changed products.</li>
          <li>Export a snapshot from this page after deploy for your own records.</li>
        </ul>
      </div>
    </div>
  );
}

