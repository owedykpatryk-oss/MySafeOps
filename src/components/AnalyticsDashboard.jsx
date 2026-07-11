import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadOrgScoped as load, ORG_CHANGED_EVENT, ORG_DATA_CHANGED_EVENT, getOrgId, ORG_ID_KEY } from "../utils/orgStorage";
import { ORG_SETTINGS_UPDATED_EVENT } from "../utils/orgSettingsStorage";
import { activeAllergenWindows, orgShowsIndustrialMoreModules } from "../utils/industrialSectors";
import { getAppliedIndustryPackId } from "../utils/orgIndustryPacks";
import { getFoodPharmaSetupStatus, isFoodPharmaPackActive } from "../utils/foodPharmaOnboarding";
import { getFessSetupStatus, isFessSetupActive } from "../utils/fessOnboarding";
import { canUseFessExclusiveFeatures } from "../utils/fessExclusive";
import FessClientSitesHub from "./FessClientSitesHub";
import FessPulseCard from "./FessPulseCard";
import { getConstructionSetupStatus, isConstructionPackActive } from "../utils/constructionOnboarding";
import { getGeospatialSetupStatus, isGeospatialPackActive } from "../utils/geospatialOnboarding";
import { isSoloWorkspace } from "../utils/soloWorkspace";
import { invalidateRegisterStatsCache, buildHseDashboardSummary, emptyHseDashboardSummary } from "../utils/moduleRegisterStats";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import WorkplaceTodayCard from "./WorkplaceTodayCard";
import ProjectHubCard from "./ProjectHubCard";
import ProjectCommandCenter from "./ProjectCommandCenter";
import { useOrgBranding } from "../hooks/useOrgBranding";
import { getOrgSettings } from "../utils/orgSettingsStorage";
import { openWorkspaceSettings, openWorkspaceView, openWorkspaceMoreSection, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { getTrialExtensionCount } from "../utils/orgMembership";
import { canExtendOrgTrial, shouldShowTrialExtensionOffer, TRIAL_EXTENSION_DAYS } from "../utils/billingAccess";
import HseRegistersCard from "./HseRegistersCard";
import {
  DASHBOARD_WIDGETS,
  isWidgetVisible,
  loadDashboardLayout,
  saveDashboardLayout,
  getWidgetOrder,
  moveWidgetInOrder,
  reorderWidget,
  setWidgetVisible,
} from "../utils/dashboardLayout";
import { missingRequiredPermits } from "../modules/permits/permitProjectDefaults";
import {
  buildProjectActionContext,
  listProjectsWithNextActions,
  openProjectNextAction,
} from "../utils/projectNextAction";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { readAudit, pushAudit } from "../utils/auditLog";
import { sanitizePdfFileSegment } from "../utils/pdfFileName";
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
function BarChart({ data, height = 80, color = "var(--color-accent, #0d9488)" }) {
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
    <div className="app-dashboard-bar-chart" style={{ display:"flex", alignItems:"flex-end", gap:2, height, padding:"4px 0" }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, height:"100%", justifyContent:"flex-end" }}>
          <div title={`${d.label}: ${d.value}`} style={{ width:"100%", height:`${Math.max(4,(d.value/max)*100)}%`, background:color, borderRadius:"6px 6px 2px 2px", minHeight:d.value>0?4:0, transition:"height .3s", opacity:0.92 }} />
          <span className="app-dashboard-bar-label">{d.label}</span>
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

function Section({ title, children, action, className = "" }) {
  return (
    <section className={`app-dashboard-section${className ? ` ${className}` : ""}`}>
      <div className="app-dashboard-section__head">
        <div className="app-section-label app-dashboard-section__title">{title}</div>
        {action ? <div className="app-dashboard-section__action">{action}</div> : null}
      </div>
      <div className="app-dashboard-section__body">{children}</div>
    </section>
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
  const branding = useOrgBranding();
  const heroBadge =
    branding.logo ? undefined : (branding.displayName || "MO").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "DB";
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
  const [dataRefreshTick, setDataRefreshTick] = useState(0);
  const [dashLayout, setDashLayout] = useState(() => loadDashboardLayout());
  const [dashCustomizeOpen, setDashCustomizeOpen] = useState(false);
  const [dragWidgetId, setDragWidgetId] = useState(null);
  const showWidget = (id) => isWidgetVisible(dashLayout, id);
  const widgetOrder = getWidgetOrder(dashLayout);
  const widgetSortOrder = (id) => {
    const i = widgetOrder.indexOf(id);
    return i >= 0 ? i : 999;
  };
  const progressBadgeRef = useRef(null);
  const dashboardPdfRef = useRef(null);

  useEffect(() => {
    const bump = () => {
      invalidateRegisterStatsCache();
      setDataRefreshTick((t) => t + 1);
    };
    const onStorage = (e) => {
      const key = e?.key || "";
      if (!key || (key !== ORG_ID_KEY && !key.endsWith(`_${getOrgId()}`))) return;
      bump();
    };
    window.addEventListener(ORG_CHANGED_EVENT, bump);
    window.addEventListener(ORG_DATA_CHANGED_EVENT, bump);
    window.addEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ORG_CHANGED_EVENT, bump);
      window.removeEventListener(ORG_DATA_CHANGED_EVENT, bump);
      window.removeEventListener(ORG_SETTINGS_UPDATED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // pull all data from localStorage (re-read after org switch, tab focus, or cloud sync)
  const workers = useMemo(() => load("mysafeops_workers", []), [dataRefreshTick]);
  const projects = useMemo(() => load("mysafeops_projects", []), [dataRefreshTick]);
  const rams = useMemo(() => load("rams_builder_docs", []), [dataRefreshTick]);
  const incidents = useMemo(() => load("mysafeops_incidents", []), [dataRefreshTick]);
  const permits = useMemo(() => load("permits_v2", []), [dataRefreshTick]);
  const snags = useMemo(() => load("snags", []), [dataRefreshTick]);
  const tsEntries = useMemo(() => load("mysafeops_timesheets", []), [dataRefreshTick]);
  const inductions = useMemo(() => load("induction_entries", []), [dataRefreshTick]);
  const trainingRecords = useMemo(() => load("training_matrix", []), [dataRefreshTick]);
  const hotWork = useMemo(() => load("hot_work_register", []), [dataRefreshTick]);
  const surveyReports = useMemo(() => load("survey_reports", []), [dataRefreshTick]);
  const methodStatements = useMemo(() => load("method_statements", []), [dataRefreshTick]);
  const geoPhotos = useMemo(() => load("geo_photos", []), [dataRefreshTick]);
  const allergenWindows = useMemo(() => load("allergen_changeover_windows", []), [dataRefreshTick]);
  const activeAllergens = useMemo(() => activeAllergenWindows(allergenWindows), [allergenWindows]);
  const foodPharmaSetup = useMemo(() => getFoodPharmaSetupStatus(), [dataRefreshTick, orgId]);
  const fessSetup = useMemo(() => getFessSetupStatus(), [dataRefreshTick, orgId]);
  const constructionSetup = useMemo(() => getConstructionSetupStatus(), [dataRefreshTick, orgId]);
  const geospatialSetup = useMemo(() => getGeospatialSetupStatus(), [dataRefreshTick, orgId]);

  // compliance score calculation
  const { score: complianceScore, issues: complianceIssues } = useMemo(() => {
    let score = 100;
    const issues = [];
    const now = new Date();

    const expiredCerts = workers.flatMap((w) =>
      (w.certifications || []).filter((c) => c.expiryDate && new Date(c.expiryDate) < now)
    );
    if (expiredCerts.length) {
      score -= Math.min(20, expiredCerts.length * 4);
      issues.push(`${expiredCerts.length} expired cert${expiredCerts.length > 1 ? "s" : ""}`);
    }

    const unsignedRams = rams.filter((r) => !r.signed && r.status !== "draft");
    if (unsignedRams.length) {
      score -= Math.min(15, unsignedRams.length * 3);
      issues.push(`${unsignedRams.length} unsigned RAMS`);
    }

    const overdueSnags = snags.filter((s) => s.dueDate && s.status === "open" && new Date(s.dueDate) < now);
    if (overdueSnags.length) {
      score -= Math.min(15, overdueSnags.length * 3);
      issues.push(`${overdueSnags.length} overdue snag${overdueSnags.length > 1 ? "s" : ""}`);
    }

    const expiredPermits = permits.filter((p) => {
      const endIso = permitEndIso(p);
      return p.status === "active" && endIso && new Date(endIso) < now;
    });
    if (expiredPermits.length) {
      score -= Math.min(20, expiredPermits.length * 5);
      issues.push(`${expiredPermits.length} expired permit${expiredPermits.length > 1 ? "s" : ""}`);
    }

    return { score: Math.max(0, score), issues };
  }, [workers, rams, snags, permits]);
  const complianceColor = complianceScore >= 80 ? "#27500A" : complianceScore >= 60 ? "#633806" : "#791F1F";

  const expiringCerts = useMemo(() => {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    return workers
      .flatMap((w) =>
        (w.certifications || [])
          .filter((c) => c.expiryDate)
          .map((c) => ({
            ...c,
            workerName: w.name,
            workerRole: w.role,
            days: daysUntil(c.expiryDate),
          }))
      )
      .filter((c) => c.days !== null && c.days <= 30)
      .sort((a, b) => a.days - b.days);
  }, [workers]);

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

  const { hoursChartData, hoursByProject } = useMemo(() => {
    const hoursByProject = {};
    tsEntries.forEach((e) => {
      const h = Object.values(e.days || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      hoursByProject[e.projectId] = (hoursByProject[e.projectId] || 0) + h;
    });
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const hoursChartData = Object.entries(hoursByProject)
      .map(([id, h]) => ({ label: (projectMap[id] || id || "Unknown").slice(0, 10), value: Math.round(h) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return { hoursChartData, hoursByProject };
  }, [tsEntries, projects]);

  const snagStats = useMemo(
    () => ({
      open: snags.filter((s) => s.status === "open").length,
      in_progress: snags.filter((s) => s.status === "in_progress").length,
      closed: snags.filter((s) => s.status === "closed").length,
    }),
    [snags]
  );

  const permitStats = useMemo(() => {
    const now = new Date();
    return {
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
  }, [permits]);

  const inductionData = useMemo(() => {
    const inductionsBySite = {};
    inductions.forEach((e) => {
      const key = e.siteName || e.siteId || "Unknown";
      inductionsBySite[key] = (inductionsBySite[key] || 0) + 1;
    });
    return Object.entries(inductionsBySite)
      .map(([l, v]) => ({ label: l.slice(0, 10), value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [inductions]);

  const monthHours = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return tsEntries
      .filter((e) => e.weekKey?.startsWith(thisMonth))
      .reduce((s, e) => s + Object.values(e.days || {}).reduce((a, v) => a + (parseFloat(v) || 0), 0), 0);
  }, [tsEntries]);

  const todayInductions = useMemo(() => {
    const today = new Date().toDateString();
    return inductions.filter((e) => new Date(e.timestamp).toDateString() === today).length;
  }, [inductions]);

  const trainingExpiring60 = useMemo(
    () =>
      trainingRecords.filter((t) => {
        if (!t.expiryDate) return false;
        const d = daysUntil(t.expiryDate);
        return d !== null && d >= 0 && d <= 60;
      }).length,
    [trainingRecords]
  );

  const [hseDashboard, setHseDashboard] = useState(() => emptyHseDashboardSummary());

  useEffect(() => {
    let cancelled = false;
    const compute = () => {
      if (!cancelled) setHseDashboard(buildHseDashboardSummary());
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(compute, { timeout: 2500 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(compute, 32);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [dataRefreshTick]);

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
        text: `${expiredCerts} worker certification(s) have expired — update competencies in People.`,
        viewId: "people",
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
    const activeProjects = projects.filter((p) => !p.closed);
    const noCoords = activeProjects.filter(
      (p) => !(p.lat != null && p.lng != null && String(p.lat).trim() !== "" && String(p.lng).trim() !== "")
    ).length;
    if (noCoords > 0) {
      items.push({
        key: "projects-no-coords",
        severity: "med",
        text: `${noCoords} active project(s) have no map coordinates — add postcode or KML in Projects.`,
        viewId: "projects",
      });
    }
    const missingPermitProjects = activeProjects.filter((p) => missingRequiredPermits(p, permits).length > 0);
    if (missingPermitProjects.length > 0) {
      const names = missingPermitProjects
        .slice(0, 2)
        .map((p) => p.name || "Site")
        .join(", ");
      items.push({
        key: "projects-missing-permits",
        severity: "med",
        text: `${missingPermitProjects.length} project(s) still need default permits (${names}${missingPermitProjects.length > 2 ? "…" : ""}).`,
        viewId: "permits",
      });
    }
    if (hseDashboard.summary.attention > 0) {
      items.push({
        key: "hse-attention",
        severity: "med",
        text: `${hseDashboard.summary.attention} HSE register(s) have overdue items or open actions — review in More.`,
        openMore: true,
      });
    }
    if (hseDashboard.summary.empty >= 5) {
      items.push({
        key: "hse-empty",
        severity: "calm",
        text: `${hseDashboard.summary.empty} HSE registers are still empty — use Seed templates in More or the dashboard HSE card.`,
        openMore: true,
        registerFilter: "empty",
      });
    }
    return items;
  }, [workers, permits, rams, snags, trainingExpiring60, projects, hseDashboard]);

  const projectsAttention = useMemo(() => {
    const ctx = buildProjectActionContext({
      rams,
      surveys: surveyReports,
      permits,
      methodStatements,
    });
    return listProjectsWithNextActions(projects, ctx).slice(0, 8);
  }, [projects, rams, surveyReports, permits, methodStatements]);

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
          { label: "People", value: String(workers.length) },
          { label: "Active projects", value: String(activeProjects) },
          { label: "RAMS documents", value: String(rams.length) },
          { label: "Permits (total)", value: String(permits.length) },
          { label: "Permits active (in date)", value: String(permitStats.active) },
          { label: "Permits past end (still active)", value: String(permitStats.expired) },
          { label: "Open snags", value: String(snagStats.open) },
          { label: "Snags in progress", value: String(snagStats.in_progress) },
          { label: "Training expiring ≤60 days", value: String(trainingExpiring60) },
          { label: "Incidents logged", value: String(incidents.length) },
          {
            label: "Geo-photos (in report / total)",
            value: `${geoPhotos.filter((g) => g.includeInReport).length} / ${geoPhotos.length}`,
          },
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

    const hse = hseDashboard.summary;
    const hseItems = [
      { label: "HSE health score", value: `${hse.healthScore}%` },
      { label: "Registers tracked", value: String(hse.tracked) },
      { label: "Empty registers", value: String(hse.empty) },
      { label: "Active (no attention flag)", value: String(hse.active) },
      { label: "Registers needing attention", value: String(hse.attention) },
      { label: "Total register records", value: String(hse.records) },
    ];
    hseDashboard.attentionModules.slice(0, 8).forEach((m) => {
      hseItems.push({
        label: `${m.label} — attention`,
        value: `${m.attentionCount} flagged · ${m.count} record${m.count === 1 ? "" : "s"}`,
      });
    });
    if (hseDashboard.emptyModules.length > 0) {
      const emptyLabels = hseDashboard.emptyModules.map((m) => m.label);
      hseItems.push({
        label: "Empty register modules",
        value:
          emptyLabels.length <= 8
            ? emptyLabels.join("; ")
            : `${emptyLabels.slice(0, 8).join("; ")} (+${emptyLabels.length - 8} more)`,
      });
    }
    sections.push({ title: "HSE register health", items: hseItems });

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
    hseDashboard,
    geoPhotos,
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
        next: "Projects → Add project",
        cta: "projects",
      },
      {
        label: "Add at least one person",
        done: workers.length > 0,
        next: "People → Add person",
        cta: "people",
      },
      { label: "Create first RAMS or permit", done: rams.length > 0 || permits.length > 0, next: "RAMS or Permits tab" },
      {
        label: isSoloWorkspace(workers)
          ? "Solo mode — one profile is enough (invite later optional)"
          : "Add at least one teammate profile",
        done: isSoloWorkspace(workers) ? workers.length >= 1 : workers.length > 1,
        next: isSoloWorkspace(workers) ? "Optional: Settings → Invites" : "Settings → Invites / Members",
        cta: isSoloWorkspace(workers) ? null : "invites",
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
      const ext = shouldShowTrialExtensionOffer({
        trialStatus,
        billing,
        trialExtensionCount: getTrialExtensionCount(),
      });
      items.push({
        key: "trial-active",
        tone: d <= 7 ? "warn" : "info",
        text:
          d <= 0
            ? "Organisation evaluation ends today — subscribe or use your one-time +14 day extension."
            : ext
              ? `Evaluation: ${d} day(s) left — you can extend once for +${TRIAL_EXTENSION_DAYS} days if you need more site time.`
              : `Organisation evaluation: ${d} day(s) remaining (this device clock).`,
        cta: ext ? "Extend or subscribe" : "Open billing",
        onCta: () => openWorkspaceSettings({ tab: "billing" }),
      });
    } else if (trialStatus && !trialStatus.isActive) {
      const ext = canExtendOrgTrial({ billing, trialExtensionCount: getTrialExtensionCount() });
      items.push({
        key: "trial-ended",
        tone: "warn",
        text: ext
          ? "Evaluation ended — read-only until you subscribe or use your one-time extension."
          : "Evaluation ended — read-only until you subscribe. Export data anytime from Backup.",
        cta: ext ? "Extend or subscribe" : "Export backup",
        onCta: () => (ext ? openWorkspaceSettings({ tab: "billing" }) : openWorkspaceView({ viewId: "backup" })),
      });
      if (!ext) {
        items.push({
          key: "trial-ended-billing",
          tone: "info",
          text: "Resume editing with Solo from £19/mo — flat org pricing, not per seat.",
          cta: "Open billing",
          onCta: () => openWorkspaceSettings({ tab: "billing" }),
        });
      }
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
    else if (cta === "people" || cta === "workers") openWorkspaceView({ viewId: "people" });
    else if (cta === "projects") openWorkspaceView({ viewId: "projects" });
    else if (cta === "invites") openWorkspaceSettings({ tab: "invites" });
  };

  const checklistCtaLabel = (cta) => {
    if (cta === "organisation") return "Open settings";
    if (cta === "people" || cta === "workers") return "Open people";
    if (cta === "projects") return "Open projects";
    if (cta === "invites") return "Open invites";
    return "Open";
  };

  const dashboardLead = useMemo(() => {
    const dataNote =
      " Metrics read from this browser for your current organisation — after cloud sync, switch tab or use Refresh metrics if numbers look stale.";
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
      { viewId: "people", label: "People" },
      { viewId: "projects", label: "Projects" },
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
        const { exportDashboardToPdf } = await import("../utils/exportDashboardPdf");
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
            `HSE register health score: ${hseDashboard.summary.healthScore}% (${hseDashboard.summary.attention} need attention · ${hseDashboard.summary.empty} empty)`,
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
    [orgName, roleLabel, orgId, pdfCoverLogoSrc, pdfSummarySections, hseDashboard]
  );

  return (
    <div className="app-dashboard" style={branding.cssVars}>
      {orgShowsIndustrialMoreModules() && activeAllergens.length > 0 ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #fbbf24",
            background: "#fffbeb",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#92400e" }}>Active allergen changeover</strong>
          <span style={{ color: "#78350f" }}>
            {" "}
            — {activeAllergens.length} window{activeAllergens.length > 1 ? "s" : ""} in progress. Review controls in{" "}
          </span>
          <button
            type="button"
            onClick={() => openWorkspaceView({ viewId: "allergen-changeovers" })}
            style={{ border: "none", background: "none", padding: 0, color: "#0d9488", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            Allergen changeovers
          </button>
          <span style={{ color: "#78350f" }}> and reference in RAMS Step 1.</span>
        </div>
      ) : null}
      {isFessSetupActive() && fessSetup.pct < 100 ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #93c5fd",
            background: "#eff6ff",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong style={{ color: "#1e40af" }}>
              FESS workspace setup — {fessSetup.complete}/{fessSetup.total} complete ({fessSetup.pct}%)
            </strong>
            <span style={{ color: "#1e3a8a" }}>
              {" "}
              · Standard site RA baseline, hygiene registers, LOTO and method statements.
            </span>
          </div>
          <button
            type="button"
            onClick={() => openWorkspaceView({ viewId: "fess-setup" })}
            style={{ ...ms.btnP, fontSize: 12, padding: "6px 12px" }}
          >
            Open FESS setup
          </button>
        </div>
      ) : null}
      {!isFessSetupActive() && isFoodPharmaPackActive() && foodPharmaSetup.pct < 100 ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #93c5fd",
            background: "#eff6ff",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong style={{ color: "#1e40af" }}>Food & pharma setup — {foodPharmaSetup.complete}/{foodPharmaSetup.total} complete ({foodPharmaSetup.pct}%)</strong>
            <span style={{ color: "#1e3a8a" }}> · Finish hygiene onboarding: hazard packs, COSHH, G&HP, client portal.</span>
          </div>
          <button
            type="button"
            onClick={() => openWorkspaceView({ viewId: "hygiene-setup" })}
            style={{ ...ms.btnP, fontSize: 12, padding: "6px 12px" }}
          >
            Open setup wizard
          </button>
        </div>
      ) : null}
      {isGeospatialPackActive() && geospatialSetup.pct < 100 ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #93c5fd",
            background: "linear-gradient(180deg,#eff6ff 0%,#dbeafe 100%)",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong style={{ color: "#1e40af" }}>Surveying setup — {geospatialSetup.complete}/{geospatialSetup.total} complete ({geospatialSetup.pct}%)</strong>
            <span style={{ color: "#1e3a8a" }}> · PAS128/AS5488, geospatial packs, survey deliverable and field permits.</span>
          </div>
          <button
            type="button"
            onClick={() => openWorkspaceView({ viewId: "construction-setup" })}
            style={{ ...ms.btnP, fontSize: 12, padding: "6px 12px" }}
          >
            Open setup wizard
          </button>
        </div>
      ) : null}
      {isConstructionPackActive() && constructionSetup.pct < 100 ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #9FE1CB",
            background: "linear-gradient(180deg,#f0fdfa 0%,#ecfdf5 100%)",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong style={{ color: "#0f766e" }}>Construction setup — {constructionSetup.complete}/{constructionSetup.total} complete ({constructionSetup.pct}%)</strong>
            <span style={{ color: "#115e59" }}> · CDM, RAMS, permits, daily briefing and client portal in one afternoon.</span>
          </div>
          <button
            type="button"
            onClick={() => openWorkspaceView({ viewId: "construction-setup" })}
            style={{ ...ms.btnP, fontSize: 12, padding: "6px 12px" }}
          >
            Open setup wizard
          </button>
        </div>
      ) : null}
      <div ref={dashboardPdfRef}>
      <PageHero
        badgeText={heroBadge}
        title="Dashboard"
        lead={dashboardLead}
        right={
          <div className="app-dashboard-hero-tools" aria-busy={pdfExporting !== null} aria-live="polite">
            <div className="app-dashboard-hero-org">
              <div className="app-dashboard-hero-org__logo">
                {org.logo ? (
                  <img src={org.logo} alt={`${orgName} logo`} />
                ) : (
                  <span className="app-dashboard-hero-org__logo-fallback">LOGO</span>
                )}
              </div>
              <div className="app-dashboard-hero-org__meta">
                <div className="app-dashboard-hero-org__name">{orgName}</div>
                <div className="app-dashboard-hero-org__role">{roleLabel}</div>
                <button
                  type="button"
                  data-no-dashboard-pdf
                  className="app-dashboard-hero-org__link"
                  onClick={() => openWorkspaceSettings({ tab: "organisation" })}
                >
                  {org.logo ? "Update branding" : "Add logo"}
                </button>
              </div>
            </div>
            <div role="group" aria-label="Export dashboard as PDF" className="app-dashboard-hero-pdf">
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
                onClick={() => setDashCustomizeOpen((v) => !v)}
                style={{ ...ms.btn, fontSize: 11, padding: "6px 10px", fontWeight: 600 }}
              >
                {dashCustomizeOpen ? "Done" : "Customize"}
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
                    setDataRefreshTick((t) => t + 1);
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
              <button
                type="button"
                data-no-dashboard-pdf
                title="Re-read registers from this device (use after D1 sync or edits in another tab)"
                onClick={() => setDataRefreshTick((t) => t + 1)}
                style={{ ...ms.btn, fontSize: 11, padding: "6px 10px", fontWeight: 600 }}
              >
                Refresh metrics
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

      {dashCustomizeOpen ? (
        <div data-no-dashboard-pdf className="app-dashboard-customize">
          <div className="app-dashboard-customize__title">Dashboard widgets</div>
          <div className="app-dashboard-customize__grid">
            {widgetOrder.map((id, idx) => {
              const w = DASHBOARD_WIDGETS.find((x) => x.id === id);
              if (!w) return null;
              return (
                <div
                  key={w.id}
                  className={`app-dashboard-customize__row${dragWidgetId === w.id ? " app-dashboard-customize__row--drag" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", w.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragWidgetId(w.id);
                  }}
                  onDragEnd={() => setDragWidgetId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragId = e.dataTransfer.getData("text/plain") || dragWidgetId;
                    if (dragId && dragId !== w.id) {
                      const next = reorderWidget(dashLayout, dragId, w.id);
                      setDashLayout(next);
                      saveDashboardLayout(next);
                    }
                    setDragWidgetId(null);
                  }}
                >
                  <span className="app-dashboard-customize__handle" aria-hidden title="Drag to reorder">
                    ⠿
                  </span>
                  <label className="app-dashboard-customize__label">
                    <input
                      type="checkbox"
                      checked={showWidget(w.id)}
                      onChange={() => {
                        const next = setWidgetVisible(dashLayout, w.id, !showWidget(w.id));
                        setDashLayout(next);
                        saveDashboardLayout(next);
                      }}
                      style={{ accentColor: branding.primaryColor }}
                    />
                    {w.label}
                  </label>
                  <span className="app-dashboard-customize__order">
                    <button
                      type="button"
                      aria-label={`Move ${w.label} up`}
                      disabled={idx === 0}
                      onClick={() => {
                        const next = moveWidgetInOrder(dashLayout, w.id, "up");
                        setDashLayout(next);
                        saveDashboardLayout(next);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${w.label} down`}
                      disabled={idx === widgetOrder.length - 1}
                      onClick={() => {
                        const next = moveWidgetInOrder(dashLayout, w.id, "down");
                        setDashLayout(next);
                        saveDashboardLayout(next);
                      }}
                    >
                      ↓
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="app-dashboard-ordered" style={{ display: "flex", flexDirection: "column" }}>

      {canUseFessExclusiveFeatures() ? (
        <div style={{ order: -1 }}>
          <FessPulseCard rams={rams} permits={permits} methodStatements={methodStatements} workers={workers} projects={projects} />
          <FessClientSitesHub
            projects={projects}
            rams={rams}
            permits={permits}
            methodStatements={methodStatements}
            variant="dashboard"
          />
        </div>
      ) : null}

      {showWidget("project_command_center") ? (
        <div style={{ order: widgetSortOrder("project_command_center") }}>
          <ProjectCommandCenter
            projects={projects}
            rams={rams}
            permits={permits}
            surveyReports={surveyReports}
            geoPhotos={geoPhotos}
          />
        </div>
      ) : null}

      {showWidget("project_hub") ? (
        <div style={{ order: widgetSortOrder("project_hub") }}>
        <ProjectHubCard
          projects={projects}
          rams={rams}
          permits={permits}
          surveyReports={surveyReports}
        />
        </div>
      ) : null}

      {showWidget("workplace_today") ? (
      <div style={{ order: widgetSortOrder("workplace_today") }}>
      <WorkplaceTodayCard
        activePermits={permitStats.active}
        permitsNeedAttention={permitStats.expired}
        openSnags={snagStats.open}
        snagsInProgress={snagStats.in_progress}
        expiringCerts={expiringCerts.filter((c) => c.days !== null && c.days <= 15).length}
        todaySignIns={todayInductions}
        urgentItems={actionNeededItems.slice(0, 3).map((it) => ({
          key: it.key,
          text: it.text,
          viewId: it.viewId,
          severity: it.severity === "urgent" ? "danger" : it.severity === "warn" ? "warning" : "info",
        }))}
      />
      </div>
      ) : null}

      {showWidget("action_needed") && actionNeededItems.length > 0 && (
        <div style={{ order: widgetSortOrder("action_needed") }}>
        <div
          className={`app-dashboard-action-strip${actionNeededItems.every((i) => i.severity === "calm") ? " app-dashboard-action-strip--calm" : ""}`}
        >
          <div className="app-section-label app-dashboard-action-strip__title">Action needed</div>
          <ul className="app-dashboard-action-strip__list" aria-live="polite">
            {actionNeededItems.map((item) => (
              <li key={item.key} className="app-dashboard-action-strip__item">
                <span className="app-dashboard-action-strip__text">{item.text}</span>
                <button
                  type="button"
                  className="app-dashboard-action-strip__btn"
                  onClick={() => {
                    if (item.openMore) {
                      openWorkspaceMoreSection({
                        registerFilter: item.registerFilter || "attention",
                      });
                    } else {
                      openWorkspaceView({ viewId: item.viewId });
                    }
                  }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
        </div>
      )}

      {showWidget("projects_attention") && projectsAttention.length > 0 ? (
        <div style={{ order: widgetSortOrder("projects_attention") }}>
          <Section
            title="Projects needing attention"
            action={
              <button
                type="button"
                onClick={() => openWorkspaceView({ viewId: "projects" })}
                style={{ ...ms.btn, padding: "6px 12px", fontSize: 12, fontWeight: 600, borderColor: "#0d9488", color: "#0f766e" }}
              >
                All projects
              </button>
            }
          >
            <ul className="app-dashboard-action-strip__list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {projectsAttention.map(({ project, action }) => (
                <li
                  key={project.id}
                  className="app-dashboard-action-strip__item"
                  style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}
                >
                  <span style={{ flex: "1 1 160px", fontWeight: 600, fontSize: 13 }}>{project.name || "Untitled project"}</span>
                  <span style={{ flex: "1 1 200px", fontSize: 12, color: "var(--color-text-secondary)" }}>{action.label}</span>
                  <button
                    type="button"
                    className="app-dashboard-action-strip__btn"
                    onClick={() => openProjectNextAction(action)}
                  >
                    Do this
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ) : null}

      {showWidget("hse_registers") ? (
        <div style={{ order: widgetSortOrder("hse_registers") }}>
          <HseRegistersCard
            summary={hseDashboard.summary}
            attentionModules={hseDashboard.attentionModules}
            emptyModules={hseDashboard.emptyModules}
            onSeeded={() => setDataRefreshTick((t) => t + 1)}
          />
        </div>
      ) : null}

      {showWidget("overview_metrics") ? (
      <div style={{ order: widgetSortOrder("overview_metrics") }}>
      <Section title="Overview">
        <p className="app-dashboard-section__hint">Tap a tile to open the related module.</p>
        <div className="app-dashboard-metrics-grid app-dashboard-stagger">
          {[
            { label: "People", value: workers.length, sub: "registered", viewId: "people", tone: "teal" },
            { label: "Active projects", value: projects.filter((p) => !p.closed).length, sub: "projects", viewId: "projects", tone: "sky" },
            { label: "RAMS total", value: rams.length, sub: "documents", viewId: "rams", tone: "teal" },
            { label: "Permits", value: permits.length, sub: `${permitStats.active} active`, viewId: "permits", tone: "amber" },
            { label: "Open snags", value: snagStats.open, sub: `${snagStats.in_progress} in progress`, viewId: "snags", tone: "rose" },
            { label: "Hours (month)", value: Math.round(monthHours), sub: `${tsEntries.length} entries`, viewId: "timesheets", tone: "indigo" },
            { label: "Incidents", value: incidents.length, sub: "total logged", viewId: "incidents", tone: "rose" },
            { label: "Training expiring", value: trainingExpiring60, sub: "within 60 days", viewId: "training", tone: "amber" },
            { label: "Hot work active", value: hotWorkActive, sub: `${hotWork.length} total records`, viewId: "hot-work", tone: "amber" },
            { label: "On site today", value: todayInductions, sub: "sign-ins", viewId: "induction", tone: "sky" },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              className={`app-dashboard-metric app-dashboard-metric--${m.tone}`}
              aria-label={`Open ${m.label}`}
              onClick={() => openWorkspaceView({ viewId: m.viewId })}
            >
              <span className="app-dashboard-metric__label">{m.label}</span>
              <span className="app-dashboard-metric__value">{m.value}</span>
              <span className="app-dashboard-metric__sub">{m.sub}</span>
            </button>
          ))}
        </div>
      </Section>
      </div>
      ) : null}

      {showWidget("charts") || showWidget("compliance") ? (
      <div style={{ order: widgetSortOrder(showWidget("charts") ? "charts" : "compliance") }}>
      <>
      <div className="app-dashboard-analytics-grid">
        <div className="app-dashboard-card app-dashboard-score-card">
          <div className="app-dashboard-card__title">Compliance score</div>
          <div className="app-dashboard-score">
            <div className="app-dashboard-score__ring" style={{ "--score-pct": complianceScore, "--score-color": complianceColor }}>
              <span className="app-dashboard-score__value">{complianceScore}</span>
            </div>
            <div className="app-dashboard-score__label" style={{ color: complianceColor }}>
              {complianceScore >= 80 ? "Good standing" : complianceScore >= 60 ? "Needs attention" : "Action required"}
            </div>
          </div>
          <div className="app-dashboard-score__bar">
            <div className="app-dashboard-score__bar-fill" style={{ width: `${complianceScore}%`, background: complianceColor }} />
          </div>
          {complianceIssues.length > 0 ? (
            <ul className="app-dashboard-score__issues">
              {complianceIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : (
            <div className="app-dashboard-score__ok">No issues detected</div>
          )}
        </div>

        <div className="app-dashboard-card">
          <div className="app-dashboard-card__title">
            Expiring certifications
            {expiringCerts.length > 0 ? <span className="app-dashboard-card__count">{expiringCerts.length}</span> : null}
          </div>
          {expiringCerts.length === 0 ? (
            <div className="app-dashboard-empty">
              {workers.length === 0 ? "No workers added yet." : "No certifications expiring in the next 30 days."}
            </div>
          ) : (
            expiringCerts.slice(0, 5).map((c, i) => (
              <ExpiryRow key={i} name={c.workerName} role={c.workerRole} certType={c.type || c.name || "Certificate"} expiryDate={c.expiryDate} />
            ))
          )}
          {expiringCerts.length > 5 ? (
            <div className="app-dashboard-card__more">+{expiringCerts.length - 5} more…</div>
          ) : null}
          {expiringCerts.length > 0 ? (
            <div className="app-dashboard-card__footer">
              <button type="button" className="app-dashboard-card__btn" onClick={() => openWorkspaceView({ viewId: "projects" })}>
                Open workers & certifications
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="app-dashboard-charts-grid">
        <div className="app-dashboard-card">
          <div className="app-dashboard-card__head">
            <div className="app-dashboard-card__title">Incidents / near misses</div>
            <div className="app-dashboard-period-toggle" role="group" aria-label="Incident chart period">
              <span className="app-dashboard-period-toggle__label">Period</span>
              {INCIDENT_PERIOD_WEEKS.map((w) => {
                const active = incidentWeeks === w;
                return (
                  <button
                    key={w}
                    type="button"
                    className={`app-pill-toggle app-dashboard-period-toggle__btn${active ? " app-dashboard-period-toggle__btn--active" : ""}`}
                    onClick={() => setIncidentWeeks(w)}
                  >
                    {w} wk
                  </button>
                );
              })}
            </div>
          </div>
          {incidents.length === 0 ? (
            <div className="app-dashboard-empty">No incidents logged yet.</div>
          ) : (
            <BarChart data={incidentTrend} height={80} color="#E24B4A" />
          )}
          <div className="app-dashboard-card__meta">
            <span>In period: {incidentsInSelectedWeeks} · All time: {incidents.length}</span>
            <span>Latest week: {incidentTrend[incidentTrend.length - 1]?.value ?? 0}</span>
            <button type="button" className="app-dashboard-card__btn app-dashboard-card__btn--inline" onClick={() => openWorkspaceView({ viewId: "incidents" })}>
              Open incidents
            </button>
          </div>
        </div>

        <div className="app-dashboard-card">
          <div className="app-dashboard-card__title">Hours per project</div>
          {hoursChartData.length === 0 ? (
            <div className="app-dashboard-empty">No timesheet data yet.</div>
          ) : (
            <BarChart data={hoursChartData} height={80} />
          )}
          <div className="app-dashboard-card__meta">
            <span>Total logged: {Math.round(monthHours)}h this month</span>
            <button type="button" className="app-dashboard-card__btn app-dashboard-card__btn--inline" onClick={() => openWorkspaceView({ viewId: "timesheets" })}>
              Open timesheets
            </button>
          </div>
        </div>

        <div className="app-dashboard-card app-dashboard-donut-card">
          <div className="app-dashboard-card__title">Snag status</div>
          <div className="app-dashboard-donut-row">
            <DonutChart
              segments={[
                { value: snagStats.open, color: "#E24B4A" },
                { value: snagStats.in_progress, color: "#EF9F27" },
                { value: snagStats.closed, color: "#1D9E75" },
              ]}
              size={80}
            />
            <div className="app-dashboard-legend">
              {[
                ["Open", snagStats.open, "#E24B4A"],
                ["In progress", snagStats.in_progress, "#EF9F27"],
                ["Closed", snagStats.closed, "#1D9E75"],
              ].map(([l, v, c]) => (
                <div key={l} className="app-dashboard-legend__row">
                  <span className="app-dashboard-legend__dot" style={{ background: c }} />
                  <span className="app-dashboard-legend__label">{l}</span>
                  <span className="app-dashboard-legend__value">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="app-dashboard-card__footer">
            <button type="button" className="app-dashboard-card__btn" onClick={() => openWorkspaceView({ viewId: "snags" })}>
              Open snags
            </button>
          </div>
        </div>

        <div className="app-dashboard-card app-dashboard-donut-card">
          <div className="app-dashboard-card__title">Permit status</div>
          <div className="app-dashboard-donut-row">
            <DonutChart
              segments={[
                { value: permitStats.active, color: "#1D9E75" },
                { value: permitStats.draft, color: "#EF9F27" },
                { value: permitStats.expired, color: "#E24B4A" },
              ]}
              size={80}
            />
            <div className="app-dashboard-legend">
              {[
                ["Active", permitStats.active, "#1D9E75"],
                ["Draft", permitStats.draft, "#EF9F27"],
                ["Expired", permitStats.expired, "#E24B4A"],
              ].map(([l, v, c]) => (
                <div key={l} className="app-dashboard-legend__row">
                  <span className="app-dashboard-legend__dot" style={{ background: c }} />
                  <span className="app-dashboard-legend__label">{l}</span>
                  <span className="app-dashboard-legend__value">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="app-dashboard-card__footer">
            <button type="button" className="app-dashboard-card__btn" onClick={() => openWorkspaceView({ viewId: "permits" })}>
              Open permits
            </button>
          </div>
        </div>

        <div className="app-dashboard-card">
          <div className="app-dashboard-card__title">Site sign-ins</div>
          {inductionData.length === 0 ? (
            <div className="app-dashboard-empty">No inductions recorded.</div>
          ) : (
            <BarChart data={inductionData} height={80} color="#378ADD" />
          )}
          <div className="app-dashboard-card__caption">
            Total: {inductions.length} · Today: {todayInductions}
          </div>
        </div>
      </div>
      </>
      </div>
      ) : null}

      {showWidget("projects_today") ? (
      <div style={{ order: widgetSortOrder("projects_today") }}>
      <Section
        title="Sites & projects today"
        action={
          <button
            type="button"
            onClick={() => openWorkspaceView({ viewId: "projects" })}
            style={{ ...ms.btn, padding: "6px 12px", fontSize: 12, fontWeight: 600, borderColor: "#0d9488", color: "#0f766e" }}
          >
            Open projects
          </button>
        }
      >
        {projects.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            No projects yet — add a site under <strong>Projects</strong>, then open the hub for RAMS, survey and PTW drafts.
          </p>
        ) : (
          <div className="app-dashboard-project-grid">
            {projects
              .filter((p) => !p.closed)
              .slice(0, 8)
              .map((p) => {
                const hrs = Math.round(hoursByProject[p.id] || 0);
                const loc = [p.address, p.postcode].filter(Boolean).join(", ");
                const hasCoords = p.lat != null && p.lng != null && String(p.lat).trim() !== "" && String(p.lng).trim() !== "";
                return (
                  <div key={p.id} className="app-dashboard-project-card">
                    <div className="app-dashboard-project-card__title">{p.name || "Untitled project"}</div>
                    {loc ? (
                      <div className="app-dashboard-project-card__meta">{loc}</div>
                    ) : (
                      <div className="app-dashboard-project-card__meta app-dashboard-project-card__meta--muted">No address on file</div>
                    )}
                    <div className="app-dashboard-project-card__meta">
                      {hrs > 0 ? `${hrs} h logged this period (timesheets)` : "No hours logged yet"}
                      {hasCoords ? " · Location set" : ""}
                    </div>
                    <div className="app-dashboard-project-card__actions">
                      <button
                        type="button"
                        className="app-dashboard-card__btn"
                        onClick={() => {
                          setWorkspaceNavTarget({ viewId: "projects", projectId: p.id, action: "viewProjectDashboard" });
                          openWorkspaceView({ viewId: "projects" });
                        }}
                      >
                        Open hub
                      </button>
                      <button type="button" className="app-dashboard-card__btn app-dashboard-card__btn--inline" onClick={() => openWorkspaceView({ viewId: "projects" })}>
                        Projects
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {projects.filter((p) => !p.closed).length > 8 ? (
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--color-text-secondary)" }}>
            Showing 8 active projects — open <strong>Projects</strong> for site hubs and linked documents.
          </p>
        ) : null}
      </Section>
      </div>
      ) : null}

      {showWidget("reminders") && dashboardReminders.length > 0 ? (
        <div style={{ order: widgetSortOrder("reminders") }}>
        <Section title="Reminders">
          <ul className="app-dashboard-reminder-list">
            {dashboardReminders.map((r) => (
              <li
                key={r.key}
                className={`app-dashboard-reminder app-dashboard-reminder--${r.tone === "warn" ? "warn" : r.tone === "calm" ? "calm" : "info"}`}
              >
                <span className="app-dashboard-reminder__text">{r.text}</span>
                <button type="button" className="app-dashboard-reminder__btn" onClick={r.onCta}>
                  {r.cta}
                </button>
              </li>
            ))}
          </ul>
        </Section>
        </div>
      ) : null}

      {showWidget("shortcuts") ? (
      <div style={{ order: widgetSortOrder("shortcuts") }}>
      <Section title="Shortcuts">
        <div className="app-dashboard-shortcuts">
          {shortcutRows.map((row) => (
            <div key={row.title}>
              <div className="app-dashboard-chip-row__label">{row.title}</div>
              <div className="app-dashboard-chip-row">
                {row.items.map((item) => (
                  <button key={item.viewId} type="button" className="app-dashboard-chip" onClick={() => openWorkspaceView({ viewId: item.viewId })}>
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
      </div>
      ) : null}

      {!onboardingDismissed && showWidget("getting_started") ? (
        <div style={{ order: widgetSortOrder("getting_started") }}>
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
          <div className="app-panel-surface app-dashboard-checklist-panel">
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
        </div>
      ) : null}

      </div>

      {isLead && (
        <div className="app-dashboard-callout">
          <strong>For managers</strong> — cross-check the{" "}
          <button type="button" onClick={() => openWorkspaceView({ viewId: "audit" })}>
            Audit log
          </button>{" "}
          after incidents or permit changes, export backups from{" "}
          <button type="button" onClick={() => openWorkspaceView({ viewId: "backup" })}>
            Backup
          </button>
          {caps.orgSettings ? (
            <>
              , and keep{" "}
              <button type="button" onClick={() => openWorkspaceSettings({ tab: "invites" })}>
                invites
              </button>{" "}
              up to date.
            </>
          ) : (
            "."
          )}
        </div>
      )}
      </div>

      <div className="app-panel-surface app-dashboard-footnote">
        All metrics are calculated live from your organisation&apos;s data. No data is shared between organisations. Dates and short dates follow your browser
        locale — choose United Kingdom in system or browser settings for British (en-GB) formatting.
      </div>
    </div>
  );
}
