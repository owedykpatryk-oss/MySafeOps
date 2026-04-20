import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadOrgScoped as load } from "../utils/orgStorage";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import SiteTodayCard from "./SiteTodayCard";
import { getOrgSettings } from "./OrgSettings";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { readAudit, pushAudit } from "../utils/auditLog";
import { exportDashboardToPdf, sanitizePdfFileSegment } from "../utils/exportDashboardPdf";
import { refreshOrgFromSupabase } from "../utils/orgMembership";

const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short" }); };
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const daysUntil = (iso) => { if (!iso) return null; return Math.ceil((new Date(iso)-new Date())/(1000*60*60*24)); };
const permitEndIso = (permit) => permit?.endDateTime || permit?.expiryDate || "";

/** ISO date (YYYY-MM-DD) of the Monday-start week for `date`. */
const getWeekLabel = (date) => {
  const d = new Date(date);
  const wd = d.getDay();
  const diff = d.getDate() - wd + (wd === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
};

const INCIDENT_PERIOD_WEEKS = [4, 8, 12];
const ONBOARDING_DISMISS_KEY = "mysafeops_onboarding_dismissed";

const PDF_PHASE_LABEL = {
  init: "Preparing export…",
  fonts: "Loading fonts…",
  layout: "Stabilising layout…",
  capture: "Capturing dashboard…",
  encode: "Encoding image…",
  assemble: "Building PDF…",
  save: "Saving file…",
};

const ss = {
  ...ms,
  card: { ...ms.card, overflow:"visible" },
  metric: {
    background: "var(--color-background-primary,#fff)",
    border: "1px solid var(--color-border-tertiary,#e2e8f0)",
    borderRadius: "var(--radius-sm, 10px)",
    padding: "14px 16px",
    boxShadow: "var(--shadow-sm)",
  },
  val: { fontSize: 26, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.02em" },
  sub: { fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)", marginTop: 4, fontWeight: 500 },
  metricBtn: {
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
};

// mini bar chart using SVG
function BarChart({ data, height = 80, color = "#0d9488" }) {
  if (!data?.length)
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "var(--color-text-secondary)",
        }}
      >
        No data yet
      </div>
    );
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:2, height, padding:"4px 0" }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, height:"100%", justifyContent:"flex-end" }}>
          <div title={`${d.label}: ${d.value}`} style={{ width:"100%", height:`${Math.max(4,(d.value/max)*100)}%`, background:color, borderRadius:"6px 6px 2px 2px", minHeight:d.value>0?4:0, transition:"height .3s", opacity:0.92 }} />
          <span style={{ fontSize:9, color:"var(--color-text-secondary)", textAlign:"center", lineHeight:1.2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// donut chart SVG
function DonutChart({ segments, size=100 }) {
  const total = segments.reduce((s,x)=>s+x.value,0) || 1;
  let offset = 0;
  const r = 38, cx = 50, cy = 50, circumference = 2*Math.PI*r;
  const arcs = segments.map(seg => {
    const pct = seg.value/total;
    const dash = pct*circumference;
    const gap = circumference-dash;
    const rotation = offset*360;
    offset += pct;
    return { ...seg, dash, gap, rotation };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border-tertiary,#e5e5e5)" strokeWidth={10} />
      {arcs.map((a,i)=>(
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={10}
          strokeDasharray={`${a.dash} ${a.gap}`}
          strokeDashoffset={circumference/4}
          transform={`rotate(${a.rotation} ${cx} ${cy})`}
          style={{ transition:"stroke-dasharray .5s" }}
        />
      ))}
      <text x={50} y={46} textAnchor="middle" fontSize={11} fontWeight={500} fill="var(--color-text-primary)">{segments.find(s=>s.value===Math.max(...segments.map(x=>x.value)))?.value||0}</text>
      <text x={50} y={58} textAnchor="middle" fontSize={8} fill="var(--color-text-secondary)">total</text>
    </svg>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 14 }}>
        <div className="app-section-label" style={{ fontSize:12, fontWeight:600, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ExpiryRow({ name, role, certType, expiryDate }) {
  const days = daysUntil(expiryDate);
  const color = days < 0 ? "#A32D2D" : days < 8 ? "#A32D2D" : days < 15 ? "#854F0B" : "#633806";
  const bg = days < 0 ? "#FCEBEB" : days < 8 ? "#FCEBEB" : days < 15 ? "#FAEEDA" : "#FAEEDA";
  return (
    <div className="app-dashboard-expiry-row" style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
      <div style={{ width:32, height:32, borderRadius:"50%", background:"#E6F1FB", color:"#0C447C", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, flexShrink:0 }}>
        {(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{certType}{role ? ` · ${role}` : ""}</div>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:bg, color }}>
          {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? "Expires today" : `${days}d left`}
        </span>
        <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>{fmtDate(expiryDate)}</div>
      </div>
    </div>
  );
}

const ROLE_LABEL = { admin: "Organisation admin", supervisor: "Supervisor", operative: "Operative" };

export default function AnalyticsDashboard() {
  const { role, caps, trialStatus, billing, orgId } = useApp();
  const { supabase } = useSupabaseAuth();
  const roleLabel = ROLE_LABEL[role] || "Team member";
  const isLead = role === "admin" || role === "supervisor";

  const [incidentWeeks, setIncidentWeeks] = useState(8);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(/** @type {null | "draft" | "email" | "print"} */ (null));
  const [pdfExportNotice, setPdfExportNotice] = useState(
    /** @type {null | { type: "ok"; fileName: string; pages: number; rasterPages?: number; summaryPages?: number } | { type: "err"; message: string }} */ (
      null
    )
  );
  const [pdfFileNameCopied, setPdfFileNameCopied] = useState(false);
  const [pdfExportPhase, setPdfExportPhase] = useState(/** @type {string | null} */ (null));
  const [roleSyncing, setRoleSyncing] = useState(false);
  const progressBadgeRef = useRef(null);
  const dashboardPdfRef = useRef(null);

  // pull all data from localStorage
  const workers = load("mysafeops_workers", []);
  const projects = load("mysafeops_projects", []);
  const rams = load("rams_builder_docs", []);
  const incidents = load("mysafeops_incidents", []);
  const permits = load("permits_v2", []);
  const snags = load("snags", []);
  const tsEntries = load("mysafeops_timesheets", []);
  const inductions = load("induction_entries", []);
  const trainingRecords = load("training_matrix", []);
  const hotWork = load("hot_work_register", []);

  // compliance score calculation
  const calcCompliance = () => {
    let score = 100, issues = [];
    const now = new Date();

    // cert expiries
    const expiredCerts = workers.flatMap(w =>
      (w.certifications||[]).filter(c => c.expiryDate && new Date(c.expiryDate) < now)
    );
    if (expiredCerts.length) { score -= Math.min(20, expiredCerts.length*4); issues.push(`${expiredCerts.length} expired cert${expiredCerts.length>1?"s":""}`); }

    // RAMS without signatures
    const unsignedRams = rams.filter(r => !r.signed && r.status !== "draft");
    if (unsignedRams.length) { score -= Math.min(15, unsignedRams.length*3); issues.push(`${unsignedRams.length} unsigned RAMS`); }

    // overdue snags
    const overdueSnags = snags.filter(s => s.dueDate && s.status==="open" && new Date(s.dueDate)<now);
    if (overdueSnags.length) { score -= Math.min(15, overdueSnags.length*3); issues.push(`${overdueSnags.length} overdue snag${overdueSnags.length>1?"s":""}`); }

    // expired permits
    const expiredPermits = permits.filter((p) => {
      const endIso = permitEndIso(p);
      return p.status === "active" && endIso && new Date(endIso) < now;
    });
    if (expiredPermits.length) { score -= Math.min(20, expiredPermits.length*5); issues.push(`${expiredPermits.length} expired permit${expiredPermits.length>1?"s":""}`); }

    return { score: Math.max(0, score), issues };
  };

  const { score: complianceScore, issues: complianceIssues } = calcCompliance();
  const complianceColor = complianceScore >= 80 ? "#27500A" : complianceScore >= 60 ? "#633806" : "#791F1F";

  // expiring certs (next 30 days)
  const now = new Date();
  const in30 = new Date(); in30.setDate(in30.getDate()+30);
  const expiringCerts = workers.flatMap(w =>
    (w.certifications||[]).filter(c => c.expiryDate).map(c => ({
      ...c, workerName:w.name, workerRole:w.role,
      days: daysUntil(c.expiryDate),
    }))
  ).filter(c => c.days !== null && c.days <= 30).sort((a,b)=>a.days-b.days);

  const { incidentTrend, incidentsInSelectedWeeks } = useMemo(() => {
    const incidentsByWeek = {};
    incidents.forEach((i) => {
      const wk = getWeekLabel(i.occurredAt || i.date || i.createdAt || new Date());
      incidentsByWeek[wk] = (incidentsByWeek[wk] || 0) + 1;
    });
    const lastN = Array.from({ length: incidentWeeks }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      return getWeekLabel(d);
    }).reverse();
    const trend = lastN.map((wk) => ({ label: fmtDate(wk), value: incidentsByWeek[wk] || 0 }));
    const inPeriod = trend.reduce((s, x) => s + x.value, 0);
    return { incidentTrend: trend, incidentsInSelectedWeeks: inPeriod };
  }, [incidents, incidentWeeks]);

  // hours per project (timesheets)
  const hoursByProject = {};
  tsEntries.forEach(e=>{
    const h = Object.values(e.days||{}).reduce((s,v)=>s+(parseFloat(v)||0),0);
    hoursByProject[e.projectId] = (hoursByProject[e.projectId]||0)+h;
  });
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const hoursData = Object.entries(hoursByProject)
    .map(([id,h])=>({ label:(projectMap[id]||id||"Unknown").slice(0,10), value:Math.round(h) }))
    .sort((a,b)=>b.value-a.value).slice(0,6);

  // snag status breakdown
  const snagStats = {
    open: snags.filter(s=>s.status==="open").length,
    in_progress: snags.filter(s=>s.status==="in_progress").length,
    closed: snags.filter(s=>s.status==="closed").length,
  };

  // permit status
  const permitStats = {
    active: permits.filter((p) => {
      const endIso = permitEndIso(p);
      return p.status === "active" && endIso && new Date(endIso) >= now;
    }).length,
    expired: permits.filter((p) => {
      const endIso = permitEndIso(p);
      return p.status === "active" && endIso && new Date(endIso) < now;
    }).length,
    draft: permits.filter((p) => p.status === "draft").length,
  };

  // inductions per site
  const inductionsBySite = {};
  inductions.forEach(e=>{ inductionsBySite[e.siteName||e.siteId||"Unknown"]=(inductionsBySite[e.siteName||e.siteId||"Unknown"]||0)+1; });
  const inductionData = Object.entries(inductionsBySite).map(([l,v])=>({ label:l.slice(0,10), value:v })).sort((a,b)=>b.value-a.value).slice(0,6);

  // total hours this month
  const thisMonth = new Date().toISOString().slice(0,7);
  const monthHours = tsEntries.filter(e=>e.weekKey?.startsWith(thisMonth)).reduce((s,e)=>s+Object.values(e.days||{}).reduce((a,v)=>a+(parseFloat(v)||0),0),0);

  const today = new Date().toDateString();
  const todayInductions = inductions.filter(e=>new Date(e.timestamp).toDateString()===today).length;

  const trainingExpiring60 = trainingRecords.filter((t) => {
    if (!t.expiryDate) return false;
    const d = daysUntil(t.expiryDate);
    return d !== null && d >= 0 && d <= 60;
  }).length;

  const actionNeededItems = useMemo(() => {
    const t = new Date();
    const items = [];
    const expiredPermits = permits.filter((p) => {
      const endIso = permitEndIso(p);
      return p.status === "active" && endIso && new Date(endIso) < t;
    }).length;
    if (expiredPermits > 0) {
      items.push({
        key: "permits-expired",
        severity: "high",
        text: `${expiredPermits} active permit(s) are past their end date — review or close them in Permits.`,
        viewId: "permits",
      });
    }
    const expiredCerts = workers.reduce(
      (n, w) => n + (w.certifications || []).filter((c) => c.expiryDate && new Date(c.expiryDate) < t).length,
      0
    );
    if (expiredCerts > 0) {
      items.push({
        key: "certs-expired",
        severity: "high",
        text: `${expiredCerts} worker certification(s) have expired — update competencies in Workers.`,
        viewId: "workers",
      });
    }
    const overdueSnags = snags.filter((s) => s.dueDate && s.status === "open" && new Date(s.dueDate) < t).length;
    if (overdueSnags > 0) {
      items.push({
        key: "snags-overdue",
        severity: "high",
        text: `${overdueSnags} open snag(s) are past their due date — resolve or re-plan in Snags.`,
        viewId: "snags",
      });
    }
    const unsignedRams = rams.filter((r) => !r.signed && r.status !== "draft").length;
    if (unsignedRams > 0) {
      items.push({
        key: "rams-unsigned",
        severity: "med",
        text: `${unsignedRams} issued RAMS document(s) are not signed — complete sign-off in RAMS.`,
        viewId: "rams",
      });
    }
    if (trainingExpiring60 > 0) {
      items.push({
        key: "training-window",
        severity: "calm",
        text: `${trainingExpiring60} training record(s) expire within 60 days — check the Training matrix.`,
        viewId: "training",
      });
    }
    return items;
  }, [workers, permits, rams, snags, trainingExpiring60]);

  const hotWorkActive = hotWork.filter((h) => h.status === "active").length;
  const org = getOrgSettings();
  const orgName = String(org.name || "My Organisation").trim() || "My Organisation";
  const orgProfileDone =
    Boolean(org.logo) ||
    String(org.name || "").trim() !== "My Organisation" ||
    [org.address, org.phone, org.email].some((x) => String(x || "").trim().length > 0);

  const pdfCoverLogoSrc = useMemo(() => {
    const u = org.logo;
    if (typeof u !== "string") return undefined;
    const s = u.toLowerCase();
    if (s.startsWith("data:image/png") || s.startsWith("data:image/jpeg") || s.startsWith("data:image/jpg")) return u;
    return undefined;
  }, [org.logo]);

  const pdfSummarySections = useMemo(() => {
    const activeProjects = projects.filter((p) => !p.closed).length;
    const sub = String(billing?.subscriptionStatus || "none");
    const trialLine =
      trialStatus == null
        ? "No trial data locally"
        : trialStatus.isActive
          ? `Active — ${trialStatus.remainingDays} day(s) left (this device)`
          : "Not active (trial end passed or unset on this device)";
    const issuesLine = complianceIssues.length ? complianceIssues.slice(0, 4).join("; ") : "None flagged";
    const sections = [
      {
        title: "Headline counts",
        items: [
          { label: "Workers", value: String(workers.length) },
          { label: "Active projects", value: String(activeProjects) },
          { label: "RAMS documents", value: String(rams.length) },
          { label: "Permits (total)", value: String(permits.length) },
          { label: "Permits active (in date)", value: String(permitStats.active) },
          { label: "Permits past end (still active)", value: String(permitStats.expired) },
          { label: "Open snags", value: String(snagStats.open) },
          { label: "Snags in progress", value: String(snagStats.in_progress) },
          { label: "Training expiring ≤60 days", value: String(trainingExpiring60) },
          { label: "Incidents logged", value: String(incidents.length) },
          { label: "Hot work active / total records", value: `${hotWorkActive} / ${hotWork.length}` },
          { label: "Sign-ins on site today", value: String(todayInductions) },
          { label: "Timesheet hours (this calendar month)", value: String(Math.round(monthHours)) },
          { label: "Compliance score (this device)", value: String(complianceScore) },
        ],
      },
      {
        title: "Alerts & billing (local)",
        items: [
          { label: "Dashboard action-needed rows", value: String(actionNeededItems.length) },
          { label: "Compliance issues (summary)", value: issuesLine },
          { label: "Stripe / subscription status", value: sub },
          { label: "Paid plan id", value: billing?.paidPlanId || "—" },
          { label: "Trial", value: trialLine },
        ],
      },
    ];
    if (actionNeededItems.length > 0) {
      sections.push({
        title: "Action needed (from dashboard)",
        items: actionNeededItems.map((it, i) => ({
          label: `#${i + 1}`,
          value: it.text.length > 240 ? `${it.text.slice(0, 237)}…` : it.text,
        })),
      });
    }
    return sections;
  }, [
    projects,
    workers.length,
    rams.length,
    permits.length,
    permitStats.active,
    permitStats.expired,
    snagStats.open,
    snagStats.in_progress,
    trainingExpiring60,
    incidents.length,
    hotWorkActive,
    hotWork.length,
    todayInductions,
    monthHours,
    complianceScore,
    complianceIssues,
    actionNeededItems,
    billing?.subscriptionStatus,
    billing?.paidPlanId,
    trialStatus,
  ]);

  const checklist = useMemo(
    () => [
      {
        label: "Add company logo and details",
        done: orgProfileDone,
        next: "Settings → Organisation",
        cta: "organisation",
      },
      {
        label: "Add at least one project",
        done: projects.length > 0,
        next: "Workers → Add project",
        cta: "workers",
      },
      {
        label: "Add at least one worker",
        done: workers.length > 0,
        next: "Workers → Add worker",
        cta: "workers",
      },
      { label: "Create first RAMS or permit", done: rams.length > 0 || permits.length > 0, next: "RAMS or Permits tab" },
      {
        label: "Add at least one teammate profile",
        done: workers.length > 1,
        next: "Settings → Invites / Members",
        cta: "invites",
      },
    ],
    [orgProfileDone, projects.length, workers.length, rams.length, permits.length]
  );
  const completedChecklist = checklist.filter((x) => x.done).length;
  const checklistDone = completedChecklist === checklist.length;
  const checklistProgressPct = Math.round((completedChecklist / Math.max(1, checklist.length)) * 100);
  const nextChecklistItem = checklist.find((item) => !item.done) || null;
  const checklistDisplay = [...checklist].sort((a, b) => Number(a.done) - Number(b.done));

  const dashboardReminders = useMemo(() => {
    const items = [];
    if (trialStatus?.isActive) {
      const d = trialStatus.remainingDays;
      items.push({
        key: "trial-active",
        tone: d <= 7 ? "warn" : "info",
        text:
          d <= 0
            ? "Organisation trial ends today — confirm billing so access is not interrupted."
            : `Organisation trial: ${d} day(s) remaining (this device clock).`,
        cta: "Open billing",
        onCta: () => openWorkspaceSettings({ tab: "billing" }),
      });
    } else if (trialStatus && !trialStatus.isActive) {
      items.push({
        key: "trial-ended",
        tone: "warn",
        text: "The organisation trial window on this device has passed — review subscription status in Billing.",
        cta: "Open billing",
        onCta: () => openWorkspaceSettings({ tab: "billing" }),
      });
    }
    const sub = String(billing?.subscriptionStatus || "none");
    const paid = billing?.paidPlanId;
    if (!paid && sub !== "none" && sub !== "active") {
      items.push({
        key: "billing-status",
        tone: "info",
        text: `Billing status: ${sub}. Open Billing to finish setup or view usage limits.`,
        cta: "Open billing",
        onCta: () => openWorkspaceSettings({ tab: "billing" }),
      });
    }
    const log = readAudit();
    const latest = log[0];
    if (latest) {
      const detail = latest.detail ? String(latest.detail) : "";
      const tail = detail.length > 120 ? `${detail.slice(0, 117)}…` : detail;
      items.push({
        key: "audit-latest",
        tone: "info",
        text: `Latest recorded activity: ${fmtDateTime(latest.at)} — ${latest.action || "event"}${tail ? ` · ${tail}` : ""}.`,
        cta: "Audit log",
        onCta: () => openWorkspaceView({ viewId: "audit" }),
      });
    }
    if (log.length > 1) {
      const prev = log[1];
      const detail = prev.detail ? String(prev.detail) : "";
      const tail = detail.length > 100 ? `${detail.slice(0, 97)}…` : detail;
      items.push({
        key: "audit-prev",
        tone: "calm",
        text: `Previous: ${fmtDateTime(prev.at)} — ${prev.action || "event"}${tail ? ` · ${tail}` : ""}.`,
        cta: "Audit log",
        onCta: () => openWorkspaceView({ viewId: "audit" }),
      });
    }
    return items;
  }, [trialStatus, billing]);

  useEffect(() => {
    try {
      setOnboardingDismissed(localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!pdfExportNotice) return;
    const ms = pdfExportNotice.type === "ok" ? 8000 : 12000;
    const id = window.setTimeout(() => setPdfExportNotice(null), ms);
    return () => window.clearTimeout(id);
  }, [pdfExportNotice]);

  useEffect(() => {
    if (!checklistDone || onboardingDismissed || !progressBadgeRef.current) return;
    progressBadgeRef.current.animate(
      [
        { transform: "scale(1)", boxShadow: "0 0 0 rgba(13,148,136,0)" },
        { transform: "scale(1.08)", boxShadow: "0 0 0 6px rgba(13,148,136,0.18)" },
        { transform: "scale(1)", boxShadow: "0 0 0 rgba(13,148,136,0)" },
      ],
      { duration: 700, easing: "ease-out", iterations: 1 }
    );
  }, [checklistDone, onboardingDismissed]);

  const dismissChecklist = () => {
    setOnboardingDismissed(true);
    try {
      localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
    } catch {}
  };

  const runChecklistCta = (cta) => {
    if (cta === "organisation") openWorkspaceSettings({ tab: "organisation" });
    else if (cta === "workers") openWorkspaceView({ viewId: "workers" });
    else if (cta === "invites") openWorkspaceSettings({ tab: "invites" });
  };

  const checklistCtaLabel = (cta) => {
    if (cta === "organisation") return "Open settings";
    if (cta === "workers") return "Open workers";
    if (cta === "invites") return "Open invites";
    return "Open";
  };

  const dashboardLead = useMemo(() => {
    const dataNote =
      " Your access level follows organisation membership from the cloud (refreshed after sign-in or sync). All numbers come from this device for your current organisation.";
    if (role === "admin") {
      return (
        <>
          <strong>Admin view</strong> — compliance, expiries, and onboarding in one place. Delegate via Settings → Invites.{dataNote}
        </>
      );
    }
    if (role === "supervisor") {
      return (
        <>
          <strong>Supervisor view</strong> — prioritise <strong>Action needed</strong>, permits, RAMS sign-off, and snags.{dataNote}
        </>
      );
    }
    return (
      <>
        <strong>Field view</strong> — jump to Permits, RAMS, or Timesheets; use the shortcuts below.{dataNote}
      </>
    );
  }, [role]);

  const shortcutRows = useMemo(() => {
    const site = [
      { viewId: "permits", label: "Permits" },
      { viewId: "rams", label: "RAMS" },
      { viewId: "workers", label: "Workers" },
      { viewId: "timesheets", label: "Timesheets" },
      { viewId: "daily-briefing", label: "Daily briefing" },
    ];
    const hseq = [
      { viewId: "snags", label: "Snags" },
      { viewId: "incidents", label: "Incidents" },
      { viewId: "inspections", label: "Inspections" },
      { viewId: "hot-work", label: "Hot work" },
    ];
    const lead = [
      { viewId: "analytics", label: "Analytics" },
      { viewId: "audit", label: "Audit log" },
      { viewId: "documents", label: "Documents" },
      { viewId: "client-portal", label: "Client portal" },
    ];
    if (role === "operative") return [{ title: "Your shortcuts", items: [...site, { viewId: "help", label: "Help" }] }];
    return [
      { title: "Site & people", items: site },
      { title: "Quality & safety", items: hseq },
      ...(isLead ? [{ title: "Reporting & records", items: lead }] : []),
    ];
  }, [role, isLead]);

  const runDashboardPdfExport = useCallback(
    async (preset) => {
      if (!dashboardPdfRef.current) return;
      setPdfExportNotice(null);
      setPdfFileNameCopied(false);
      setPdfExportPhase(null);
      setPdfExporting(preset);
      const t = new Date();
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      try {
        const result = await exportDashboardToPdf(dashboardPdfRef.current, {
          preset,
          title: orgName,
          subtitle: `${t.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${roleLabel}`,
          fileNamePrefix: sanitizePdfFileSegment(
            orgId && String(orgId).trim() && String(orgId) !== "default" ? String(orgId) : orgName,
            44
          ),
          coverTagline:
            "Figures on the next page are selectable text; the rest is a visual capture of this dashboard from this device for the current organisation.",
          coverExtraLines: [
            offline ? "Browser reported offline when exporting — figures are still from this device only." : null,
            `UTC export: ${t.toISOString()}`,
            orgId && String(orgId).trim() && String(orgId) !== "default" ? `Organisation: ${orgId}` : null,
            "Numbers: device-local aggregates only (not a live cloud replica).",
          ].filter(Boolean),
          coverLogoSrc: pdfCoverLogoSrc,
          summarySections: pdfSummarySections,
          includeCover: true,
          foreignObjectRendering: false,
          onPhase: (phase) => {
            if (phase === "complete") setPdfExportPhase(null);
            else setPdfExportPhase(phase);
          },
        });
        pushAudit({ action: "dashboard_pdf_export", entity: "dashboard", detail: `${orgName} (${preset})` });
        setPdfExportNotice({
          type: "ok",
          fileName: result.fileName,
          pages: result.pages,
          rasterPages: result.rasterPages,
          summaryPages: result.summaryPages,
        });
      } catch (err) {
        const message = err?.message || "Could not create PDF.";
        setPdfExportNotice({ type: "err", message });
        alert(message);
      } finally {
        setPdfExporting(null);
        setPdfExportPhase(null);
      }
    },
    [orgName, roleLabel, orgId, pdfCoverLogoSrc, pdfSummarySections]
  );

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      <div ref={dashboardPdfRef}>
      <PageHero
        badgeText="DB"
        title="Dashboard"
        lead={dashboardLead}
        right={
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 10, minWidth: 200 }}
            aria-busy={pdfExporting !== null}
            aria-live="polite"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--color-border-tertiary,#e2e8f0)",
                background: "var(--color-background-primary,#fff)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                  background: "var(--color-background-secondary,#f7f7f5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {org.logo ? (
                  <img src={org.logo} alt={`${orgName} logo`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>
                    LOGO
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                  {orgName}
                </div>
                <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2, fontWeight: 600 }}>{roleLabel}</div>
                <button
                  type="button"
                  data-no-dashboard-pdf
                  onClick={() => openWorkspaceSettings({ tab: "organisation" })}
                  style={{ ...ms.btn, fontSize: 11, padding: "3px 8px", marginTop: 4 }}
                >
                  {org.logo ? "Update branding" : "Add logo"}
                </button>
              </div>
            </div>
            <div
              role="group"
              aria-label="Export dashboard as PDF"
              style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                data-no-dashboard-pdf
                disabled={pdfExporting !== null}
                title="Fastest, smallest JPEG — quick notes (KPI rows capped for speed)"
                onClick={() => runDashboardPdfExport("draft")}
                style={{ ...ms.btn, fontSize: 11, padding: "6px 10px", fontWeight: 600 }}
              >
                {pdfExporting === "draft" ? "Preparing…" : "PDF · Draft"}
              </button>
              <button
                type="button"
                data-no-dashboard-pdf
                disabled={pdfExporting !== null}
                title="JPEG, 1.5× scale — smaller file for email and Teams"
                onClick={() => runDashboardPdfExport("email")}
                style={{ ...ms.btn, fontSize: 11, padding: "6px 10px", fontWeight: 600, borderColor: "#0d9488", color: "#0f766e" }}
              >
                {pdfExporting === "email" ? "Preparing…" : "PDF · Email"}
              </button>
              <button
                type="button"
                data-no-dashboard-pdf
                disabled={pdfExporting !== null}
                title="PNG raster, 2.25× scale — best for print and projectors (larger file)"
                onClick={() => runDashboardPdfExport("print")}
                style={{ ...ms.btn, fontSize: 11, padding: "6px 10px", fontWeight: 600, borderColor: "#0f766e", background: "var(--color-accent-muted,#ecfdf5)", color: "#0f766e" }}
              >
                {pdfExporting === "print" ? "Preparing…" : "PDF · Print"}
              </button>
              <button
                type="button"
                data-no-dashboard-pdf
                disabled={!supabase || roleSyncing}
                title={!supabase ? "Sign in with Supabase to sync membership." : undefined}
                onClick={async () => {
                  if (!supabase) return;
                  setRoleSyncing(true);
                  try {
                    await refreshOrgFromSupabase(supabase);
                    pushAudit({ action: "membership_role_refresh", entity: "org", detail: "dashboard" });
                  } catch (err) {
                    alert(err?.message || "Could not refresh organisation from the cloud.");
                  } finally {
                    setRoleSyncing(false);
                  }
                }}
                style={{ ...ms.btn, fontSize: 11, padding: "6px 10px", fontWeight: 600 }}
              >
                {roleSyncing ? "Syncing…" : "Sync role from cloud"}
              </button>
            </div>
            {pdfExportPhase && PDF_PHASE_LABEL[pdfExportPhase] ? (
              <p
                data-no-dashboard-pdf
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#0f766e",
                  textAlign: "right",
                }}
              >
                {PDF_PHASE_LABEL[pdfExportPhase]}
              </p>
            ) : null}
            <p
              data-no-dashboard-pdf
              style={{
                margin: "6px 0 0",
                fontSize: 10,
                color: "var(--color-text-tertiary,#94a3b8)",
                lineHeight: 1.45,
                textAlign: "right",
              }}
            >
              PDF: cover + KPI (searchable) + action lines + dashboard image. Filename includes date and time. Draft skips font wait and uses a smaller KPI cap for speed.
            </p>
            {pdfExportNotice?.type === "ok" ? (
              <div
                data-no-dashboard-pdf
                role="status"
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #86efac",
                  background: "#f0fdf4",
                  fontSize: 11,
                  color: "#166534",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  Saved <strong>{pdfExportNotice.fileName}</strong> ({pdfExportNotice.pages} page
                  {pdfExportNotice.pages === 1 ? "" : "s"}
                  {pdfExportNotice.summaryPages != null && pdfExportNotice.summaryPages > 0
                    ? ` · ${pdfExportNotice.summaryPages} KPI text`
                    : ""}
                  {pdfExportNotice.rasterPages != null ? ` · ${pdfExportNotice.rasterPages} image sheet(s)` : ""}).
                </span>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    data-no-dashboard-pdf
                    onClick={async () => {
                      try {
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(pdfExportNotice.fileName);
                          setPdfFileNameCopied(true);
                          window.setTimeout(() => setPdfFileNameCopied(false), 2000);
                        }
                      } catch {
                        /* ignore */
                      }
                    }}
                    style={{
                      ...ms.btn,
                      fontSize: 10,
                      padding: "2px 8px",
                      borderColor: "#16a34a",
                      color: "#166534",
                    }}
                  >
                    {pdfFileNameCopied ? "Copied" : "Copy filename"}
                  </button>
                  <button
                    type="button"
                    data-no-dashboard-pdf
                    onClick={() => setPdfExportNotice(null)}
                    style={{
                      ...ms.btn,
                      fontSize: 10,
                      padding: "2px 8px",
                      borderColor: "#16a34a",
                      color: "#166534",
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            ) : pdfExportNotice?.type === "err" ? (
              <div
                data-no-dashboard-pdf
                role="alert"
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  fontSize: 11,
                  color: "#991b1b",
                }}
              >
                {pdfExportNotice.message}
              </div>
            ) : null}
          </div>
        }
      />

      <SiteTodayCard
        workerCount={workers.length}
        activePermits={permitStats.active}
        ramsCount={rams.length}
        todaySignIns={todayInductions}
      />

      <Section
        title="Sites & projects today"
        action={
          <button
            type="button"
            onClick={() => openWorkspaceView({ viewId: "site-map" })}
            style={{ ...ms.btn, padding: "6px 12px", fontSize: 12, fontWeight: 600, borderColor: "#0d9488", color: "#0f766e" }}
          >
            Open site map
          </button>
        }
      >
        {projects.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            No projects yet — add sites under <strong>Workers</strong>, then open the map to see everyone in one place.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
            {projects
              .filter((p) => !p.closed)
              .slice(0, 8)
              .map((p) => {
                const hrs = Math.round(hoursByProject[p.id] || 0);
                const loc = [p.address, p.postcode].filter(Boolean).join(", ");
                const hasCoords = p.lat != null && p.lng != null && String(p.lat).trim() !== "" && String(p.lng).trim() !== "";
                return (
                  <div
                    key={p.id}
                    style={{
                      ...ss.card,
                      padding: "12px 14px",
                      border: "1px solid var(--color-border-tertiary,#e2e8f0)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>{p.name || "Untitled project"}</div>
                    {loc ? (
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>{loc}</div>
                    ) : (
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>No address on file</div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                      {hrs > 0 ? `${hrs} h logged this period (timesheets)` : "No hours logged yet"}
                      {hasCoords ? " · On map" : ""}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => openWorkspaceView({ viewId: "workers" })}
                        style={{ ...ms.btn, fontSize: 11, padding: "4px 8px" }}
                      >
                        Workers
                      </button>
                      <button
                        type="button"
                        onClick={() => openWorkspaceView({ viewId: "site-map" })}
                        style={{ ...ms.btn, fontSize: 11, padding: "4px 8px", borderColor: "#0d9488", color: "#0f766e" }}
                      >
                        Map
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {projects.filter((p) => !p.closed).length > 8 ? (
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--color-text-secondary)" }}>
            Showing 8 active projects — open <strong>Site map</strong> for the full list.
          </p>
        ) : null}
      </Section>

      {dashboardReminders.length > 0 ? (
        <Section title="Reminders">
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {dashboardReminders.map((r) => {
              const border =
                r.tone === "warn"
                  ? "1px solid rgba(180,83,9,0.35)"
                  : r.tone === "calm"
                    ? "1px solid var(--color-border-tertiary,#e2e8f0)"
                    : "1px solid rgba(13,148,136,0.25)";
              const bg =
                r.tone === "warn"
                  ? "rgba(254,243,199,0.45)"
                  : r.tone === "calm"
                    ? "var(--color-background-secondary,#f8fafc)"
                    : "rgba(13,148,136,0.06)";
              return (
                <li
                  key={r.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border,
                    background: bg,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5, flex: "1 1 220px" }}>{r.text}</span>
                  <button
                    type="button"
                    onClick={r.onCta}
                    style={{
                      ...ms.btn,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                      borderColor: "#0d9488",
                      color: "#0f766e",
                    }}
                  >
                    {r.cta}
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section title="Shortcuts">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {shortcutRows.map((row) => (
            <div key={row.title}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary,#64748b)", marginBottom: 8, letterSpacing: "0.04em" }}>{row.title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {row.items.map((item) => (
                  <button
                    key={item.viewId}
                    type="button"
                    onClick={() => openWorkspaceView({ viewId: item.viewId })}
                    style={{
                      ...ms.btn,
                      padding: "8px 12px",
                      fontSize: 12,
                      minHeight: 0,
                      borderColor: "#0d9488",
                      background: "var(--color-accent-muted,#ecfdf5)",
                      color: "#0f766e",
                      fontWeight: 600,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {role === "operative" ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
              Some modules may be view-only depending on your organisation. Ask an admin if you need access to Settings or imports.
            </p>
          ) : null}
        </div>
      </Section>

      {isLead && (
        <div
          style={{
            marginBottom: 24,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(13,148,136,0.25)",
            background: "rgba(13,148,136,0.06)",
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--color-text-primary)",
          }}
        >
          <strong style={{ color: "#0f766e" }}>For managers</strong> — cross-check the{" "}
          <button type="button" onClick={() => openWorkspaceView({ viewId: "audit" })} style={{ padding: 0, border: "none", background: "none", color: "#0d9488", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            Audit log
          </button>{" "}
          after incidents or permit changes, export backups from{" "}
          <button type="button" onClick={() => openWorkspaceView({ viewId: "backup" })} style={{ padding: 0, border: "none", background: "none", color: "#0d9488", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            Backup
          </button>
          {caps.orgSettings ? (
            <>
              , and keep{" "}
              <button
                type="button"
                onClick={() => openWorkspaceSettings({ tab: "invites" })}
                style={{ padding: 0, border: "none", background: "none", color: "#0d9488", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
              >
                invites
              </button>{" "}
              up to date.
            </>
          ) : (
            "."
          )}
        </div>
      )}

      {actionNeededItems.length > 0 && (
        <div
          className={`app-dashboard-action-strip${actionNeededItems.every((i) => i.severity === "calm") ? " app-dashboard-action-strip--calm" : ""}`}
          style={{ marginBottom: 24 }}
        >
          <div
            className="app-section-label"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}
          >
            Action needed
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }} aria-live="polite">
            {actionNeededItems.map((item) => (
              <li
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5, flex: "1 1 200px" }}>{item.text}</span>
                <button
                  type="button"
                  onClick={() => openWorkspaceView({ viewId: item.viewId })}
                  style={{
                    ...ms.btn,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                    borderColor: "#0d9488",
                    background: "var(--color-accent-muted,#ccfbf1)",
                    color: "#0f766e",
                  }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* top metrics */}
      <Section title="Overview">
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--color-text-secondary)" }}>Tap a tile to open the related module.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(130px,100%),1fr))", gap: 10 }}>
          {[
            { label: "Workers", value: workers.length, sub: "registered", viewId: "workers" },
            { label: "Active projects", value: projects.filter((p) => !p.closed).length, sub: "projects", viewId: "workers" },
            { label: "RAMS total", value: rams.length, sub: "documents", viewId: "rams" },
            { label: "Permits", value: permits.length, sub: `${permitStats.active} active`, viewId: "permits" },
            { label: "Open snags", value: snagStats.open, sub: `${snagStats.in_progress} in progress`, viewId: "snags" },
            { label: "Hours (month)", value: Math.round(monthHours), sub: `${tsEntries.length} entries`, viewId: "timesheets" },
            { label: "Incidents", value: incidents.length, sub: "total logged", viewId: "incidents" },
            { label: "Training expiring", value: trainingExpiring60, sub: "within 60 days", viewId: "training" },
            { label: "Hot work active", value: hotWorkActive, sub: `${hotWork.length} total records`, viewId: "hot-work" },
            { label: "On site today", value: todayInductions, sub: "sign-ins", viewId: "induction" },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              className="app-dashboard-metric"
              aria-label={`Open ${m.label}`}
              onClick={() => openWorkspaceView({ viewId: m.viewId })}
              style={{ ...ss.metric, ...ss.metricBtn }}
            >
              <div style={ss.lbl}>{m.label}</div>
              <div style={ss.val}>{m.value}</div>
              <div style={ss.sub}>{m.sub}</div>
            </button>
          ))}
        </div>
      </Section>
      </div>

      {!onboardingDismissed && (
        <Section
          title="Getting started checklist"
          action={
            checklistDone ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  ref={progressBadgeRef}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "2px 8px",
                    background: "#dcfce7",
                    color: "#166534",
                  }}
                >
                  100%
                </span>
                <button type="button" style={{ ...ms.btn, padding: "6px 10px", fontSize: 12 }} onClick={dismissChecklist}>
                  Dismiss
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {completedChecklist}/{checklist.length} complete
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "2px 8px",
                    background: "var(--color-accent-muted,#ccfbf1)",
                    color: "var(--color-accent,#0d9488)",
                  }}
                >
                  {checklistProgressPct}%
                </span>
              </div>
            )
          }
        >
          <div className="app-panel-surface" style={{ padding: "12px 14px" }}>
            <div
              role="progressbar"
              aria-label="Onboarding checklist progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={checklistProgressPct}
              style={{ marginBottom: 12 }}
            >
              <div style={{ height: 8, borderRadius: 999, background: "var(--color-border-tertiary,#e2e8f0)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${checklistProgressPct}%`,
                    borderRadius: 999,
                    background: "linear-gradient(90deg,#0d9488 0%, #14b8a6 100%)",
                    transition: "width .25s ease",
                  }}
                />
              </div>
            </div>

            {checklistDone && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "10px 12px",
                  marginBottom: 10,
                  borderRadius: 10,
                  border: "1px solid #86efac",
                  background: "#f0fdf4",
                }}
              >
                <div style={{ minWidth: 220, flex: "1 1 260px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>Checklist complete</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "#166534", lineHeight: 1.35 }}>
                    Nice work. You can dismiss this panel to keep your dashboard cleaner.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissChecklist}
                  style={{
                    ...ms.btn,
                    padding: "8px 12px",
                    fontSize: 12,
                    borderColor: "#16a34a",
                    background: "#dcfce7",
                    color: "#166534",
                    flexShrink: 0,
                  }}
                >
                  Dismiss checklist
                </button>
              </div>
            )}

            {!checklistDone && nextChecklistItem?.cta && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "10px 12px",
                  marginBottom: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(13,148,136,.3)",
                  background: "rgba(13,148,136,.08)",
                }}
              >
                <div style={{ minWidth: 220, flex: "1 1 260px" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, color: "#0f766e" }}>
                    Next best action
                  </div>
                  <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.35 }}>
                    {nextChecklistItem.label}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => runChecklistCta(nextChecklistItem.cta)}
                  style={{
                    ...ms.btn,
                    padding: "8px 12px",
                    fontSize: 12,
                    borderColor: "#0d9488",
                    background: "var(--color-accent-muted,#ccfbf1)",
                    color: "#0f766e",
                    flexShrink: 0,
                  }}
                >
                  {checklistCtaLabel(nextChecklistItem.cta)}
                </button>
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {checklistDisplay.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    padding: "10px 12px",
                    border: "1px solid var(--color-border-tertiary,#e2e8f0)",
                    borderRadius: 10,
                    background: item.done ? "var(--color-background-secondary,#f8fafc)" : "var(--color-background-primary,#fff)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: "1 1 320px", minWidth: 220 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        background: item.done ? "#dcfce7" : "#e2e8f0",
                        color: item.done ? "#166534" : "#334155",
                        flexShrink: 0,
                      }}
                    >
                      {item.done ? "✓" : "•"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.35 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 3, lineHeight: 1.35 }}>
                        Next: {item.next}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 999,
                        padding: "3px 8px",
                        background: item.done ? "#dcfce7" : "#f1f5f9",
                        color: item.done ? "#166534" : "#334155",
                      }}
                    >
                      {item.done ? "Complete" : "Pending"}
                    </span>
                    {item.cta && (
                      <button
                        type="button"
                        onClick={() => runChecklistCta(item.cta)}
                        style={{
                          padding: "6px 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 8,
                          border: "1px solid #0d9488",
                          background: "var(--color-accent-muted,#ccfbf1)",
                          color: "#0f766e",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {checklistCtaLabel(item.cta)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* compliance + expiring */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(200px,100%),1fr))", gap:16, marginBottom:24 }}>
        {/* compliance score */}
        <div className="app-dashboard-card" style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Compliance score</div>
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontSize:52, fontWeight:500, color:complianceColor, lineHeight:1 }}>{complianceScore}</div>
            <div style={{ fontSize:12, color:complianceColor, marginTop:4 }}>{complianceScore>=80?"Good standing":complianceScore>=60?"Needs attention":"Action required"}</div>
          </div>
          <div style={{ height:6, background:"var(--color-border-tertiary,#e5e5e5)", borderRadius:3, marginBottom:12 }}>
            <div style={{ height:6, borderRadius:3, width:`${complianceScore}%`, background:complianceColor, transition:"width .5s" }} />
          </div>
          {complianceIssues.length>0 ? (
            <div>
              {complianceIssues.map((issue,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#791F1F", marginBottom:4 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#E24B4A", flexShrink:0 }} />
                  {issue}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:12, color:"#27500A", display:"flex", alignItems:"center", gap:6 }}>
              <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="#27500A" strokeWidth={2}><circle cx={8} cy={8} r={6}/><path d="M5 8l2 2 4-4"/></svg>
              No issues detected
            </div>
          )}
        </div>

        {/* expiring certs */}
        <div className="app-dashboard-card" style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>
            Expiring certifications
            {expiringCerts.length>0 && <span style={{ marginLeft:8, padding:"1px 8px", borderRadius:20, fontSize:11, background:"#FCEBEB", color:"#791F1F" }}>{expiringCerts.length}</span>}
          </div>
          {expiringCerts.length===0 ? (
            <div style={{ textAlign:"center", padding:"1.5rem 0", fontSize:13, color:"var(--color-text-secondary)" }}>
              {workers.length===0 ? "No workers added yet." : "No certifications expiring in the next 30 days."}
            </div>
          ) : (
            expiringCerts.slice(0,5).map((c,i)=>(
              <ExpiryRow key={i} name={c.workerName} role={c.workerRole} certType={c.type||c.name||"Certificate"} expiryDate={c.expiryDate} />
            ))
          )}
          {expiringCerts.length > 5 && (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8 }}>+{expiringCerts.length - 5} more…</div>
          )}
          {expiringCerts.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => openWorkspaceView({ viewId: "workers" })} style={{ ...ms.btn, padding: "6px 12px", fontSize: 12, minHeight: 0 }}>
                Open workers & certifications
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(200px,100%),1fr))", gap:12, marginBottom:24 }}>
        {/* incident trend */}
        <div className="app-dashboard-card" style={ss.card}>
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:4 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em" }}>
              Incidents / near misses
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }} role="group" aria-label="Incident chart period">
              <span style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)" }}>Period</span>
              {INCIDENT_PERIOD_WEEKS.map((w) => {
                const active = incidentWeeks === w;
                return (
                  <button
                    key={w}
                    type="button"
                    className="app-pill-toggle"
                    onClick={() => setIncidentWeeks(w)}
                    style={{
                      padding:"4px 10px",
                      fontSize:11,
                      fontWeight:500,
                      borderRadius:6,
                      border:`1px solid ${active ? "var(--color-accent,#0d9488)" : "var(--color-border-tertiary,#e5e5e5)"}`,
                      background: active ? "rgba(13,148,136,0.12)" : "var(--color-background-primary,#fff)",
                      color: active ? "var(--color-accent,#0d9488)" : "var(--color-text-secondary)",
                      cursor:"pointer",
                    }}
                  >
                    {w} wk
                  </button>
                );
              })}
            </div>
          </div>
          {incidents.length===0 ? (
            <div style={{ padding:"1.5rem 0", textAlign:"center", fontSize:12, color:"var(--color-text-secondary)" }}>No incidents logged yet.</div>
          ) : (
            <BarChart data={incidentTrend} height={80} color="#E24B4A" />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
            <span>In period: {incidentsInSelectedWeeks} · All time: {incidents.length}</span>
            <span>Latest week: {incidentTrend[incidentTrend.length - 1]?.value ?? 0}</span>
            <button type="button" onClick={() => openWorkspaceView({ viewId: "incidents" })} style={{ ...ms.btn, padding: "4px 10px", fontSize: 11, minHeight: 0 }}>
              Open incidents
            </button>
          </div>
        </div>

        {/* hours per project */}
        <div className="app-dashboard-card" style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Hours per project</div>
          {hoursData.length===0 ? (
            <div style={{ padding:"1.5rem 0", textAlign:"center", fontSize:12, color:"var(--color-text-secondary)" }}>No timesheet data yet.</div>
          ) : (
            <BarChart data={hoursData} height={80} color="#0d9488" />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Total logged: {Math.round(monthHours)}h this month</span>
            <button type="button" onClick={() => openWorkspaceView({ viewId: "timesheets" })} style={{ ...ms.btn, padding: "4px 10px", fontSize: 11, minHeight: 0 }}>
              Open timesheets
            </button>
          </div>
        </div>
      </div>

      {/* bottom row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))", gap:12, marginBottom:24 }}>
        {/* snag breakdown */}
        <div className="app-dashboard-card" style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Snag status</div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <DonutChart segments={[
              { value:snagStats.open, color:"#E24B4A" },
              { value:snagStats.in_progress, color:"#EF9F27" },
              { value:snagStats.closed, color:"#1D9E75" },
            ]} size={80} />
            <div>
              {[["Open",snagStats.open,"#E24B4A"],["In progress",snagStats.in_progress,"#EF9F27"],["Closed",snagStats.closed,"#1D9E75"]].map(([l,v,c])=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, fontSize:12 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:c, flexShrink:0 }} />
                  <span style={{ color:"var(--color-text-secondary)" }}>{l}</span>
                  <span style={{ fontWeight:500, marginLeft:"auto" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => openWorkspaceView({ viewId: "snags" })} style={{ ...ms.btn, padding: "4px 10px", fontSize: 11, minHeight: 0 }}>
              Open snags
            </button>
          </div>
        </div>

        {/* permit breakdown */}
        <div className="app-dashboard-card" style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Permit status</div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <DonutChart segments={[
              { value:permitStats.active, color:"#1D9E75" },
              { value:permitStats.draft, color:"#EF9F27" },
              { value:permitStats.expired, color:"#E24B4A" },
            ]} size={80} />
            <div>
              {[["Active",permitStats.active,"#1D9E75"],["Draft",permitStats.draft,"#EF9F27"],["Expired",permitStats.expired,"#E24B4A"]].map(([l,v,c])=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, fontSize:12 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:c, flexShrink:0 }} />
                  <span style={{ color:"var(--color-text-secondary)" }}>{l}</span>
                  <span style={{ fontWeight:500, marginLeft:"auto" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => openWorkspaceView({ viewId: "permits" })} style={{ ...ms.btn, padding: "4px 10px", fontSize: 11, minHeight: 0 }}>
              Open permits
            </button>
          </div>
        </div>

        {/* site inductions */}
        <div className="app-dashboard-card" style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Site sign-ins</div>
          {inductionData.length===0 ? (
            <div style={{ padding:"1rem 0", textAlign:"center", fontSize:12, color:"var(--color-text-secondary)" }}>No inductions recorded.</div>
          ) : (
            <BarChart data={inductionData} height={80} color="#378ADD" />
          )}
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>Total: {inductions.length} · Today: {todayInductions}</div>
        </div>
      </div>

      <div
        className="app-panel-surface app-dashboard-footnote"
        style={{
          padding: "14px 18px",
          fontSize: 12,
          color: "var(--color-text-secondary)",
          lineHeight: 1.65,
          borderLeft: "3px solid var(--color-accent-subtle)",
        }}
      >
        All metrics are calculated live from your organisation&apos;s data. No data is shared between organisations. Dates and short dates follow your browser
        locale — choose United Kingdom in system or browser settings for British (en-GB) formatting.
      </div>
    </div>
  );
}
