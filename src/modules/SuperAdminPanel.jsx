import { useEffect, useMemo, useState } from "react";
import PageHero from "../components/PageHero";
import { ms } from "../utils/moduleStyles";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useApp } from "../context/AppContext";
import { isSuperAdminEmail, SUPERADMIN_EMAIL } from "../utils/superAdmin";

const ss = ms;
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

function monthLabel(date) {
  return new Date(date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function buildMonthBuckets(rows, getDate, months = 6) {
  const now = new Date();
  const buckets = [];
  const map = {};
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map[key] = { key, label: monthLabel(d), count: 0 };
    buckets.push(map[key]);
  }
  rows.forEach((row) => {
    const t = Date.parse(String(getDate(row) || ""));
    if (!Number.isFinite(t)) return;
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (map[key]) map[key].count += 1;
  });
  return buckets;
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

async function readCloudSummary(supabase) {
  if (!supabase) return { ok: false, message: "Cloud database not configured." };
  try {
    const orgRes = await supabase
      .from("organizations")
      .select("id, created_at, billing_plan, subscription_status", { count: "exact" })
      .limit(5000);
    if (orgRes.error) throw orgRes.error;
    const orgRows = Array.isArray(orgRes.data) ? orgRes.data : [];
    const now = Date.now();
    const orgCreated30d = orgRows.filter((r) => {
      const t = Date.parse(String(r?.created_at || ""));
      return Number.isFinite(t) && now - t <= 30 * 24 * 60 * 60 * 1000;
    }).length;
    const bySub = {};
    const byPlan = {};
    orgRows.forEach((r) => {
      const sub = String(r?.subscription_status || "unknown");
      const plan = String(r?.billing_plan || "none");
      bySub[sub] = toNum(bySub[sub]) + 1;
      byPlan[plan] = toNum(byPlan[plan]) + 1;
    });
    const memberRes = await supabase.from("org_members").select("id", { count: "exact", head: true });
    const totalMembers = memberRes.error ? null : memberRes.count;
    const registrationsTrend = buildMonthBuckets(orgRows, (r) => r.created_at, 6);
    const paidCount = orgRows.filter((r) => {
      const plan = String(r?.billing_plan || "none").toLowerCase();
      return ["starter", "team", "business"].includes(plan);
    }).length;
    return {
      ok: true,
      fetchedAt: new Date().toISOString(),
      totalOrganisations: orgRes.count ?? orgRows.length,
      organisations30d: orgCreated30d,
      totalMembers,
      paidCount,
      registrationsTrend,
      subscriptions: Object.entries(bySub).sort((a, b) => b[1] - a[1]),
      plans: Object.entries(byPlan).sort((a, b) => b[1] - a[1]),
    };
  } catch (err) {
    return { ok: false, fetchedAt: new Date().toISOString(), message: err?.message || "Cloud summary not available." };
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
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const allowed = isSuperAdminEmail(user?.email);
  const localSummary = useMemo(() => readLocalOrgUsage(), [localRefreshKey]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoadingCloud(true);
    readCloudSummary(supabase).then((next) => {
      if (!cancelled) setCloud(next);
      if (!cancelled) setLoadingCloud(false);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, supabase]);

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
      localSummary,
      cloudSummary: cloud,
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
    if (cloud.ok) {
      lines.push(toCsvLine(["cloud", "total_organisations", cloud.totalOrganisations]));
      lines.push(toCsvLine(["cloud", "new_organisations_30d", cloud.organisations30d]));
      lines.push(toCsvLine(["cloud", "total_members", cloud.totalMembers ?? ""]));
      lines.push(toCsvLine(["cloud", "paid_conversion", cloudPaidPct]));
      (cloud.plans || []).forEach(([plan, count]) => lines.push(toCsvLine(["plan", plan, count])));
      (cloud.subscriptions || []).forEach(([status, count]) => lines.push(toCsvLine(["subscription", status, count])));
    }
    localSummary.topModules.forEach((m) => lines.push(toCsvLine(["top_module", m.module, m.count])));
    localSummary.topActions.forEach((a) => lines.push(toCsvLine(["top_action", a.action, a.count])));
    downloadFile(`mysafeops-superadmin-snapshot-${new Date().toISOString().slice(0, 10)}.csv`, `${lines.join("\n")}\n`, "text/csv");
  };

  if (!allowed) {
    return (
      <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0" }}>
        <PageHero badgeText="SA" title="Superadmin" lead="Restricted access." />
        <div style={ss.card}>This page is available only for `{SUPERADMIN_EMAIL}`.</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0" }}>
      <PageHero
        badgeText="SA"
        title="Superadmin control panel"
        lead="Cross-org operational summary. Shows aggregates only; no raw records are exposed."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setLocalRefreshKey((x) => x + 1)} style={ss.btn}>
              Refresh local
            </button>
            <button
              type="button"
              onClick={() => {
                setLoadingCloud(true);
                readCloudSummary(supabase).then((next) => {
                  setCloud(next);
                  setLoadingCloud(false);
                });
              }}
              style={ss.btn}
              disabled={loadingCloud}
            >
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px,100%), 1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Organisations seen (device)" value={localSummary.organisationsDetected} sub="From local org-scoped keys" />
        <StatCard label="Active orgs (15 min)" value={localSummary.activeOrg15m} sub="Based on latest audit activity" />
        <StatCard label="Active orgs (24h)" value={localSummary.activeOrg24h} sub={`Activity ratio: ${activeRatio}`} />
        <StatCard label="Audit events (device)" value={localSummary.totalAuditEvents} sub="All org-scoped audit rows" />
        <StatCard
          label="Cloud paid conversion"
          value={cloudPaidPct}
          sub={cloud.ok ? `${cloud.paidCount}/${cloud.totalOrganisations} paid organisations` : "Cloud metrics unavailable"}
        />
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Subscription snapshot</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Current org status: <strong>{billing?.subscriptionStatus || "none"}</strong>
          {billing?.paidPlanId ? ` · Plan: ${billing.paidPlanId}` : ""}
          {trialStatus?.isActive ? ` · Trial: ${trialStatus.remainingDays} day(s) left` : ""}
        </div>
      </div>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Cloud summary (Supabase)</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            Last fetch: {cloud?.fetchedAt ? new Date(cloud.fetchedAt).toLocaleString() : "—"}
          </div>
        </div>
        {loadingCloud ? (
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Loading cloud metrics...</div>
        ) : cloud.ok ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13 }}>
              Registered organisations: <strong>{cloud.totalOrganisations}</strong> · New in 30 days: <strong>{cloud.organisations30d}</strong>
              {cloud.totalMembers != null ? (
                <>
                  {" "}
                  · Total members: <strong>{cloud.totalMembers}</strong>
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
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Cloud metrics unavailable: {cloud.message}
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
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Module adoption (avg records/org)</div>
          {localSummary.moduleAdoption.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No local datasets detected.</div>
          ) : (
            localSummary.moduleAdoption.slice(0, 8).map((row) => (
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
    </div>
  );
}

