import { useState, useEffect, useRef } from "react";

const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const sk = (k) => `${k}_${getOrgId()}`;
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(sk(k)) || JSON.stringify(fb)); } catch { return fb; } };
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short" }); };
const daysUntil = (iso) => { if (!iso) return null; return Math.ceil((new Date(iso)-new Date())/(1000*60*60*24)); };

const ss = {
  card: { background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, padding:"1.25rem" },
  metric: { background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, padding:"12px 14px" },
  lbl: { fontSize:11, color:"var(--color-text-secondary)", marginBottom:4, fontWeight:500 },
  val: { fontSize:24, fontWeight:500, color:"var(--color-text-primary)" },
  sub: { fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:2 },
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
          <div title={`${d.label}: ${d.value}`} style={{ width:"100%", height:`${Math.max(4,(d.value/max)*100)}%`, background:color, borderRadius:"2px 2px 0 0", minHeight:d.value>0?4:0, transition:"height .3s" }} />
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
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{title}</div>
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
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
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
  const [period, setPeriod] = useState("30d");

  // pull all data from localStorage
  const workers = load("mysafeops_workers", []);
  const projects = load("mysafeops_projects", []);
  const rams = load("mysafeops_rams", []);
  const incidents = load("mysafeops_incidents", []);
  const permits = load("mysafeops_permits", []);
  const snags = load("snags", []);
  const tsEntries = load("mysafeops_timesheets", []);
  const inductions = load("induction_entries", []);

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
    const expiredPermits = permits.filter(p => p.expiryDate && new Date(p.expiryDate)<now && p.status==="active");
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

  // incidents per week (last 8 weeks)
  const getWeekLabel = (date) => {
    const d = new Date(date); const wd = d.getDay(); const diff = d.getDate()-wd+(wd===0?-6:1);
    return new Date(d.setDate(diff)).toISOString().slice(0,10);
  };
  const incidentsByWeek = {};
  incidents.forEach(i => {
    const wk = getWeekLabel(i.date||i.createdAt||new Date());
    incidentsByWeek[wk] = (incidentsByWeek[wk]||0)+1;
  });
  const last8weeks = Array.from({length:8},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i*7); return getWeekLabel(d);
  }).reverse();
  const incidentTrend = last8weeks.map(wk=>({ label:fmtDate(wk), value:incidentsByWeek[wk]||0 }));

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
    active: permits.filter(p=>p.status==="active").length,
    expired: permits.filter(p=>p.status==="expired"||(p.expiryDate&&new Date(p.expiryDate)<now)).length,
    pending: permits.filter(p=>p.status==="pending").length,
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

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {/* header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:8 }}>
        <div>
          <h2 style={{ fontWeight:500, fontSize:20, margin:0 }}>Analytics</h2>
          <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"2px 0 0" }}>Live overview across all modules</p>
        </div>
      </div>

      {/* top metrics */}
      <Section title="Overview">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10 }}>
          {[
            { label:"Workers", value:workers.length, sub:"registered" },
            { label:"Active projects", value:projects.filter(p=>!p.closed).length, sub:"projects" },
            { label:"RAMS total", value:rams.length, sub:"documents" },
            { label:"Permits", value:permits.length, sub:permitStats.active+" active" },
            { label:"Open snags", value:snagStats.open, sub:snagStats.in_progress+" in progress" },
            { label:"Hours (month)", value:Math.round(monthHours), sub:tsEntries.length+" entries" },
            { label:"Incidents", value:incidents.length, sub:"total logged" },
            { label:"On site today", value:todayInductions, sub:"sign-ins" },
          ].map(m=>(
            <div key={m.label} style={ss.metric}>
              <div style={ss.lbl}>{m.label}</div>
              <div style={ss.val}>{m.value}</div>
              <div style={ss.sub}>{m.sub}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* compliance + expiring */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:16, marginBottom:24 }}>
        {/* compliance score */}
        <div style={ss.card}>
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
        <div style={ss.card}>
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
        {/* incident trend */}
        <div style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Incidents / near misses — 8 weeks</div>
          {incidents.length===0 ? (
            <div style={{ padding:"1.5rem 0", textAlign:"center", fontSize:12, color:"var(--color-text-secondary)" }}>No incidents logged yet.</div>
          ) : (
            <BarChart data={incidentTrend} height={80} color="#E24B4A" />
          )}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>
            <span>Total: {incidents.length}</span>
            <span>This week: {incidentTrend[incidentTrend.length-1]?.value||0}</span>
          </div>
        </div>

        {/* hours per project */}
        <div style={ss.card}>
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:24 }}>
        {/* snag breakdown */}
        <div style={ss.card}>
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
        <div style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Permit status</div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <DonutChart segments={[
              { value:permitStats.active, color:"#1D9E75" },
              { value:permitStats.pending, color:"#EF9F27" },
              { value:permitStats.expired, color:"#E24B4A" },
            ]} size={80} />
            <div>
              {[["Active",permitStats.active,"#1D9E75"],["Pending",permitStats.pending,"#EF9F27"],["Expired",permitStats.expired,"#E24B4A"]].map(([l,v,c])=>(
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
        <div style={ss.card}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Site sign-ins</div>
          {inductionData.length===0 ? (
            <div style={{ padding:"1rem 0", textAlign:"center", fontSize:12, color:"var(--color-text-secondary)" }}>No inductions recorded.</div>
          ) : (
            <BarChart data={inductionData} height={80} color="#378ADD" />
          )}
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>Total: {inductions.length} · Today: {todayInductions}</div>
        </div>
      </div>

      <div style={{ padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        All metrics are calculated live from your organisation's data. No data is shared between organisations.
      </div>
    </div>
  );
}
