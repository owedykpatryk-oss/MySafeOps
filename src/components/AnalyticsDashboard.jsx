import { useEffect, useMemo, useState } from "react";
import { loadOrgScoped as load } from "../utils/orgStorage";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import SiteTodayCard from "./SiteTodayCard";
import { getOrgSettings } from "./OrgSettings";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";

const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short" }); };
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
};

// mini bar chart using SVG
function BarChart({ data, height=80, color="#0d9488" }) {
  if (!data?.length) return <div style={{ height, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"var(--color-text-secondary)" }}>No data yet</div>;
  const max = Math.max(...data.map(d=>d.value), 1);
  const w = 100 / data.length;
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

// sparkline
function Sparkline({ values, color="#0d9488", height=32 }) {
  if (!values?.length || values.every(v=>v===0)) return <div style={{ height, fontSize:11, color:"var(--color-text-secondary)", display:"flex", alignItems:"center" }}>—</div>;
  const max = Math.max(...values, 1);
  const w = 100/(values.length-1||1);
  const pts = values.map((v,i)=>`${i*w},${height-(v/max)*(height-4)}`).join(" ");
  return (
    <svg width="100%" height={height} style={{ overflow:"visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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

function ExpiryRow({ name, role, certType, expiryDate, urgent }) {
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

export default function AnalyticsDashboard() {
  const [incidentWeeks, setIncidentWeeks] = useState(8);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

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
  const complianceBg = complianceScore >= 80 ? "#EAF3DE" : complianceScore >= 60 ? "#FAEEDA" : "#FCEBEB";

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

  useEffect(() => {
    try {
      setOnboardingDismissed(localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1");
    } catch {}
  }, []);

  const dismissChecklist = () => {
    setOnboardingDismissed(true);
    try {
      localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      <PageHero
        badgeText="DB"
        title="Dashboard"
        lead={
          <>
            Live metrics from this browser. Use <strong>Permits</strong>, <strong>RAMS</strong>, <strong>Workers</strong>, or <strong>More</strong> below for every module.
          </>
        }
        right={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--color-border-tertiary,#e2e8f0)",
              background: "var(--color-background-primary,#fff)",
              minWidth: 200,
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
              <button
                type="button"
                onClick={() => openWorkspaceSettings({ tab: "organisation" })}
                style={{ ...ms.btn, fontSize: 11, padding: "3px 8px", marginTop: 4 }}
              >
                {org.logo ? "Update branding" : "Add logo"}
              </button>
            </div>
          </div>
        }
      />

      <SiteTodayCard
        workerCount={workers.length}
        activePermits={permitStats.active}
        ramsCount={rams.length}
        todaySignIns={todayInductions}
      />

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
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(130px,100%),1fr))", gap:10 }}>
          {[
            { label:"Workers", value:workers.length, sub:"registered" },
            { label:"Active projects", value:projects.filter(p=>!p.closed).length, sub:"projects" },
            { label:"RAMS total", value:rams.length, sub:"documents" },
            { label:"Permits", value:permits.length, sub:permitStats.active+" active" },
            { label:"Open snags", value:snagStats.open, sub:snagStats.in_progress+" in progress" },
            { label:"Hours (month)", value:Math.round(monthHours), sub:tsEntries.length+" entries" },
            { label:"Incidents", value:incidents.length, sub:"total logged" },
            { label:"Training expiring", value:trainingExpiring60, sub:"within 60 days" },
            { label:"Hot work active", value:hotWorkActive, sub:`${hotWork.length} total records` },
            { label:"On site today", value:todayInductions, sub:"sign-ins" },
          ].map(m=>(
            <div key={m.label} className="app-dashboard-metric" style={ss.metric}>
              <div style={ss.lbl}>{m.label}</div>
              <div style={ss.val}>{m.value}</div>
              <div style={ss.sub}>{m.sub}</div>
            </div>
          ))}
        </div>
      </Section>

      {!onboardingDismissed && (
        <Section
          title="Getting started checklist"
          action={
            checklistDone ? (
              <button type="button" style={{ ...ms.btn, padding: "6px 10px", fontSize: 12 }} onClick={dismissChecklist}>
                Dismiss
              </button>
            ) : (
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {completedChecklist}/{checklist.length} complete
              </span>
            )
          }
        >
          <div className="app-panel-surface" style={{ padding: "12px 14px" }}>
            <div style={{ display: "grid", gap: 8 }}>
              {checklist.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-border-tertiary,#e2e8f0)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 18,
                        height: 18,
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
                    <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{item.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{item.next}</span>
                    {item.cta && (
                      <button
                        type="button"
                        onClick={() => {
                          if (item.cta === "organisation") openWorkspaceSettings({ tab: "organisation" });
                          else if (item.cta === "workers") openWorkspaceView({ viewId: "workers" });
                          else if (item.cta === "invites") openWorkspaceSettings({ tab: "invites" });
                        }}
                        style={{
                          padding: "4px 10px",
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
                        Open
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
          {expiringCerts.length>5 && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:8 }}>+{expiringCerts.length-5} more…</div>}
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
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:8, fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>
            <span>In period: {incidentsInSelectedWeeks} · All time: {incidents.length}</span>
            <span>Latest week: {incidentTrend[incidentTrend.length - 1]?.value ?? 0}</span>
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
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>Total logged: {Math.round(monthHours)}h this month</div>
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
