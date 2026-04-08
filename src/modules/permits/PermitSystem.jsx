import { useState, useEffect, useRef } from "react";
import { ms } from "../../utils/moduleStyles";
import PageHero from "../../components/PageHero";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

const genId = () => `ptw_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtDateTime = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); };
const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };

const permitPersonLabel = (w) => `${w.name || ""}${w.role ? ` — ${w.role}` : ""}`.trim();

function matchWorkerPick(str, workers) {
  if (!str?.trim()) return "";
  const t = str.trim();
  const m = workers.find((w) => permitPersonLabel(w) === t || (w.name || "").trim() === t);
  return m ? m.id : "__custom__";
}

const ss = {
  ...ms,
  btnO: { padding:"10px 14px", borderRadius:6, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  btnR: { padding:"10px 14px", borderRadius:6, border:"0.5px solid #A32D2D", background:"#FCEBEB", color:"#791F1F", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  ta:   { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", lineHeight:1.5 },
};

// ─── All 15 permit types ──────────────────────────────────────────────────────
const PERMIT_TYPES = {
  hot_work: {
    label: "Hot work permit",
    color: "#E24B4A", bg: "#FCEBEB",
    icon: "M12 2c-4 6-4 10 0 14 2-3 2-5 0-7 1 5 5 7 5 10a5 5 0 01-10 0c0-5 5-9 5-17z",
    description: "Welding, grinding, cutting, brazing, soldering — any work producing heat or sparks",
    checklist: [
      "Area cleared of all combustible materials within 10 metres",
      "2 × 9kg fire extinguishers and fire blanket in position",
      "Hot works equipment inspected and in good condition",
      "Fire alarm isolated in work area (with supervisor approval)",
      "Sprinkler heads protected where applicable",
      "Fire watch person nominated and briefed",
      "All drains, ducts and openings sealed against spark entry",
      "Work area wetted down where appropriate",
      "Permit duration agreed — maximum 8 hours",
      "Post-work inspection after minimum 1 hour agreed",
    ],
    extraFields: [
      { key:"equipment", label:"Equipment to be used", type:"text" },
      { key:"fireWatcher", label:"Fire watcher name", type:"text" },
      { key:"postInspectionTime", label:"Post-work inspection time", type:"datetime-local" },
    ],
  },
  electrical: {
    label: "Electrical isolation permit",
    color: "#185FA5", bg: "#E6F1FB",
    icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    description: "Safe isolation of electrical circuits, LOTO, live electrical work",
    checklist: [
      "Isolation point identified and confirmed",
      "Isolation carried out by authorised person",
      "Lock-off device applied and padlock secured",
      "Warning notice posted at isolation point",
      "Voltage indicator tested on known live source",
      "System proved dead with voltage indicator (GS38 compliant)",
      "Voltage indicator re-tested on known live source after proving dead",
      "All connected equipment confirmed de-energised",
      "Permit held by the person performing the work",
    ],
    extraFields: [
      { key:"circuitRef", label:"Circuit / board reference", type:"text" },
      { key:"lockoutRef", label:"Lock-out padlock number", type:"text" },
      { key:"authorisedPerson", label:"Authorised person (isolation)", type:"text" },
    ],
  },
  work_at_height: {
    label: "Work at height permit",
    color: "#854F0B", bg: "#FAEEDA",
    icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
    description: "Scaffold, MEWP, ladders, rope access — any work above 2m",
    checklist: [
      "Access equipment inspected and signed off before use",
      "Scaffold: handover certificate reviewed and current",
      "MEWP: daily pre-use check completed; operator holds IPAF card",
      "Edge protection confirmed in place at all open edges",
      "Harness and lanyard inspected; attached to anchor point",
      "Exclusion zone established below work area",
      "Weather conditions assessed — not commenced in high winds or ice",
      "Rescue plan in place for MEWP/rope access operations",
      "Overhead hazards identified and communicated",
    ],
    extraFields: [
      { key:"accessEquipment", label:"Access equipment type / ref", type:"text" },
      { key:"maxHeight", label:"Maximum working height (m)", type:"number" },
      { key:"rescuePlan", label:"Rescue plan reference", type:"text" },
    ],
  },
  confined_space: {
    label: "Confined space entry permit",
    color: "#791F1F", bg: "#FCEBEB",
    icon: "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4a6 6 0 110 12A6 6 0 0112 6z",
    description: "Entry into tanks, vessels, sewers, voids — any confined space",
    checklist: [
      "Confined space risk assessment reviewed and current",
      "Atmospheric test completed: O₂ (19.5–23.5%), CO (<20ppm), H₂S (<1ppm), LEL (<10%)",
      "Continuous monitoring in use during occupation",
      "Mechanical ventilation provided and confirmed operational",
      "Stand-by person briefed and in position outside space",
      "Rescue equipment (tripod, winch, harness) rigged and ready",
      "Emergency rescue plan confirmed with stand-by person",
      "All energy sources isolated (LOTO) before entry",
      "Communication system tested between entrant and stand-by",
      "Maximum occupancy and time in space agreed",
    ],
    extraFields: [
      { key:"spaceDescription", label:"Space description / location", type:"text" },
      { key:"standByPerson", label:"Stand-by person name", type:"text" },
      { key:"atmosphericReadings", label:"Initial atmospheric readings", type:"text" },
    ],
  },
  excavation: {
    label: "Permit to dig / excavation",
    color: "#3B6D11", bg: "#EAF3DE",
    icon: "M2 20h20M5 20V8l7-6 7 6v12",
    description: "Any excavation, ground disturbance, core drilling — utility strike prevention",
    checklist: [
      "Utility drawings obtained from all relevant authorities",
      "CAT scan (Cable Avoidance Tool) survey completed",
      "Survey results marked out on ground before breaking",
      "Hand dig zone (0.5m either side of marked service) confirmed",
      "Excavation supervisor nominated and briefed",
      "Shoring / trench support confirmed if depth exceeds 1.2m",
      "Safe means of access and egress provided",
      "Spoil stored minimum 0.5m from excavation edge",
      "Barriers and covers in place over open excavation",
      "Adjacent structures assessed for undermining risk",
    ],
    extraFields: [
      { key:"catScanBy", label:"CAT scan carried out by", type:"text" },
      { key:"knownServices", label:"Known services in area", type:"text" },
      { key:"excavationDepth", label:"Maximum excavation depth (m)", type:"number" },
    ],
  },
  lifting: {
    label: "Lifting operations permit",
    color: "#3C3489", bg: "#EEEDFE",
    icon: "M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3",
    description: "Crane lifts, MEWP lifts, pallet truck lifts — all LOLER operations",
    checklist: [
      "Lifting plan prepared by competent person",
      "All lifting equipment within current LOLER thorough examination",
      "Appointed Person (AP) present for crane lifts",
      "Rigging plan reviewed — correct sling type, rating and angle",
      "Load weight confirmed — does not exceed SWL of any component",
      "Exclusion zone established below and around lift",
      "Banksman / slinger in position with agreed signal system",
      "Ground conditions checked — stable, level, adequate bearing capacity",
      "Overhead hazards (power lines, structures) confirmed clear",
      "Weather / wind speed assessed and within limits",
    ],
    extraFields: [
      { key:"liftingEquipment", label:"Lifting equipment / crane ID", type:"text" },
      { key:"swl", label:"SWL of equipment (tonnes)", type:"number" },
      { key:"appointedPerson", label:"Appointed Person name", type:"text" },
    ],
  },
  cold_work: {
    label: "Cold work permit",
    color: "#0C447C", bg: "#E6F1FB",
    icon: "M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
    description: "Maintenance on live plant without hot works — LOTO, mechanical isolation",
    checklist: [
      "All energy sources identified (electrical, pneumatic, hydraulic, gravity, stored pressure)",
      "Full LOTO applied to all energy isolation points",
      "System depressurised and confirmed pressure-free",
      "Stored energy (springs, counterweights) safely discharged",
      "Permit holder has sole control of all padlocks",
      "Try-out: attempt to start/operate equipment — confirmed no movement",
      "Adjacent equipment not affected by isolation confirmed or separately isolated",
      "Waste / drainage provisions in place for fluid release",
    ],
    extraFields: [
      { key:"equipmentTag", label:"Equipment tag / ID", type:"text" },
      { key:"isolationPoints", label:"Number of isolation points", type:"number" },
      { key:"lotoKeyHolder", label:"LOTO key holder name", type:"text" },
    ],
  },
  line_break: {
    label: "Line break permit",
    color: "#712B13", bg: "#FAECE7",
    icon: "M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83",
    description: "Opening any pressurised pipe, vessel or system containing fluid, gas or chemical",
    checklist: [
      "System isolated, depressurised and confirmed at atmospheric pressure",
      "Contents identified — COSHH assessment reviewed for any chemical release",
      "Drain / bleed point confirmed fully open before breaking joint",
      "PPE specified for contents (chemical resistant, face shield, etc.) in use",
      "Drip trays or containment in place for residual fluids",
      "Adjacent systems confirmed isolated — no inadvertent pressurisation possible",
      "Permit holder holds all isolation certificates",
      "First break carried out slowly; standby for unexpected pressure release",
      "Spill kit and emergency wash available at point of work",
    ],
    extraFields: [
      { key:"pipeContents", label:"Pipe contents", type:"text" },
      { key:"workingPressure", label:"Normal working pressure (bar)", type:"number" },
      { key:"temperature", label:"Contents temperature (°C)", type:"number" },
    ],
  },
  roof_access: {
    label: "Roof access permit",
    color: "#633806", bg: "#FAEEDA",
    icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
    description: "Any access to roof — flat, pitched, fragile or otherwise",
    checklist: [
      "Pre-access roof condition survey completed",
      "Fragile materials (rooflights, AC cement) identified and marked",
      "Edge protection confirmed in place at all leading edges",
      "Access route agreed — no walking on fragile surfaces",
      "Crawling boards available for any fragile surface crossing",
      "Weather assessed — not accessed in ice, snow or wind above 15 m/s",
      "Maximum persons on roof agreed and not exceeded",
      "Materials secured against wind displacement",
      "No materials or tools left at roof edge unattended",
      "Post-work roof inspection before closing permit",
    ],
    extraFields: [
      { key:"roofType", label:"Roof type (flat/pitched/fragile)", type:"text" },
      { key:"accessMethod", label:"Access method (ladder/scaffold/hatch)", type:"text" },
      { key:"maxPersons", label:"Maximum persons on roof", type:"number" },
    ],
  },
  night_works: {
    label: "Night / out-of-hours permit",
    color: "#26215C", bg: "#EEEDFE",
    icon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    description: "Works outside normal operating hours — night, weekend, holiday",
    checklist: [
      "Site manager / client representative notified and approved out-of-hours working",
      "Emergency contact for site owner confirmed and available",
      "Security arrangements reviewed — site access and alarm procedures confirmed",
      "Lone working risk assessment completed if applicable",
      "First aider available or first aid arrangements confirmed adequate",
      "All workers briefed on emergency procedures for out-of-hours",
      "Adequate lighting confirmed before works commence",
      "Noise restrictions for out-of-hours work identified and communicated",
      "Check-in / check-out system in place",
    ],
    extraFields: [
      { key:"siteContact", label:"Out-of-hours site contact / phone", type:"text" },
      { key:"securityCode", label:"Security / alarm arrangements", type:"text" },
      { key:"loneworkingArrangement", label:"Lone working check-in interval", type:"text" },
    ],
  },
  valve_isolation: {
    label: "Valve isolation permit",
    color: "#085041", bg: "#E1F5EE",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4v8m0 4h.01",
    description: "Planned operation of process valves — food, pharma, chemical, water",
    checklist: [
      "P&ID reviewed — all valves to be operated identified",
      "Upstream and downstream system status confirmed",
      "Consequence of valve operation reviewed (product loss, pressure build, backflow)",
      "All downstream operatives notified before valve operation",
      "Valve position indicator / position confirmed before and after operation",
      "Isolation confirmed by zero-flow check where applicable",
      "Pressure differential across isolation confirmed safe",
      "Blind flange / spade confirmation where positive isolation required",
      "Valve closure documented in site log",
    ],
    extraFields: [
      { key:"valveTag", label:"Valve tag number(s)", type:"text" },
      { key:"systemContents", label:"System contents", type:"text" },
      { key:"authorisedOperator", label:"Authorised valve operator", type:"text" },
    ],
  },
  visitor_access: {
    label: "Visitor / contractor access permit",
    color: "#444441", bg: "#F1EFE8",
    icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    description: "Authorised access for visitors, auditors, clients, new subcontractors",
    checklist: [
      "Visitor identity confirmed and signed in at reception",
      "Site induction completed or confirmed current",
      "PPE requirements communicated and confirmed compliance",
      "Visitor escort assigned for duration of visit",
      "Restricted areas identified — visitor not to enter without escort",
      "Emergency procedure explained to visitor",
      "Visitor contact details recorded",
      "Purpose of visit recorded",
      "Sign-out confirmed on departure",
    ],
    extraFields: [
      { key:"visitorCompany", label:"Visitor company", type:"text" },
      { key:"purposeOfVisit", label:"Purpose of visit", type:"text" },
      { key:"escortName", label:"Escort / host name", type:"text" },
    ],
  },
  radiography: {
    label: "Radiography permit",
    color: "#791F1F", bg: "#FCEBEB",
    icon: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41",
    description: "Gamma-ray or X-ray NDT inspection — ionising radiation source use",
    checklist: [
      "Radiation Protection Supervisor (RPS) authorised the work in writing",
      "Radiation Protection Adviser (RPA) consulted for non-routine operations",
      "Controlled area barriers and warning signs in place (minimum 2m from source)",
      "All persons in vicinity briefed — controlled area must remain clear",
      "Dose rate survey completed; boundaries confirmed adequate",
      "Dosimeters issued to all classified workers",
      "Source transport container inspected; integrity confirmed",
      "Emergency procedures confirmed with all personnel",
      "Post-exposure survey completed; source confirmed returned to container",
      "Dose records updated on completion",
    ],
    extraFields: [
      { key:"sourceType", label:"Radiation source type (Ir-192, X-ray, etc.)", type:"text" },
      { key:"rps", label:"Radiation Protection Supervisor name", type:"text" },
      { key:"controlledAreaRadius", label:"Controlled area radius (m)", type:"number" },
    ],
  },
  ground_disturbance: {
    label: "Ground disturbance permit",
    color: "#27500A", bg: "#EAF3DE",
    icon: "M3 20h18M5 20V8l7-6 7 6v12M9 20v-6h6v6",
    description: "Piling, ground anchors, driven posts, any disturbance beyond CAT scan depth",
    checklist: [
      "Ground investigation report reviewed — soil type, contamination, voids, buried structures",
      "All utility records obtained; CAT scan completed",
      "Archaeological or heritage desk-based assessment completed where required",
      "UXO (unexploded ordnance) risk assessed — clearance certificate if applicable",
      "Ground disturbance method approved by geotechnical engineer",
      "Vibration monitoring on adjacent structures — alert thresholds set",
      "Pre-work condition survey of all adjacent structures completed and photographed",
      "Groundwater monitoring in place if dewatering required",
      "Environmental protection: no ground disturbance adjacent to watercourse without EA consent",
    ],
    extraFields: [
      { key:"groundType", label:"Ground type / geology", type:"text" },
      { key:"disturbanceMethod", label:"Method of disturbance", type:"text" },
      { key:"maxDepth", label:"Maximum disturbance depth (m)", type:"number" },
    ],
  },
  general: {
    label: "General permit to work",
    color: "#5F5E5A", bg: "#F1EFE8",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    icon2: true,
    description: "General works not covered by a specific permit type",
    checklist: [
      "Work scope clearly defined and communicated to all operatives",
      "Hazards identified and controls in place",
      "Appropriate PPE issued and worn",
      "Emergency procedures communicated",
      "First aid arrangements confirmed",
      "Permit area identified and access controlled",
    ],
    extraFields: [],
  },
};

// ─── Live countdown timer component ──────────────────────────────────────────
function Countdown({ expiresAt }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt) - new Date();
      setRemaining(diff);
    };
    calc();
    const t = setInterval(calc, 30000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (remaining === null) return null;

  if (remaining <= 0) return (
    <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:"#FCEBEB", color:"#791F1F" }}>
      EXPIRED
    </span>
  );

  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const urgent = remaining < 1800000; // 30 min
  const warning = remaining < 7200000; // 2 hours

  return (
    <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500,
      background: urgent ? "#FCEBEB" : warning ? "#FAEEDA" : "#EAF3DE",
      color: urgent ? "#791F1F" : warning ? "#633806" : "#27500A",
    }}>
      {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} remaining
    </span>
  );
}

// ─── Permit form ─────────────────────────────────────────────────────────────
function PermitForm({ permit, onSave, onClose }) {
  const projects = load("mysafeops_projects",[]);
  const workers = load("mysafeops_workers",[]);
  const org = (() => { try { return JSON.parse(localStorage.getItem("mysafeops_org_settings")||"{}"); } catch { return {}; } })();

  const defaultType = permit?.type || "hot_work";
  const [type, setType] = useState(defaultType);
  const def = PERMIT_TYPES[type];

  const initChecklist = (t) => Object.fromEntries((PERMIT_TYPES[t]?.checklist||[]).map((c,i)=>[i,false]));

  const blank = {
    id:genId(), type, projectId:"", location:"",
    description:"", issuedTo:"", issuedBy: org.defaultLeadEngineer||"",
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now()+8*3600000).toISOString(),
    checklist: initChecklist(type),
    extraFields:{}, status:"active",
    createdAt: new Date().toISOString(),
    notes:"",
  };

  const [form, setForm] = useState(permit ? {...permit, checklist: permit.checklist||initChecklist(permit.type||type)} : blank);
  const [issuedToPick, setIssuedToPick] = useState(() => (permit ? matchWorkerPick(permit.issuedTo, workers) : ""));
  const [issuedByPick, setIssuedByPick] = useState(() => {
    if (permit) return matchWorkerPick(permit.issuedBy, workers);
    return matchWorkerPick(org.defaultLeadEngineer || "", workers);
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setExtra = (k,v) => setForm(f=>({...f,extraFields:{...f.extraFields,[k]:v}}));
  const setCheck = (i,v) => setForm(f=>({...f,checklist:{...f.checklist,[i]:v}}));

  const onIssuedToSelect = (e) => {
    const v = e.target.value;
    if (v === "") { setIssuedToPick(""); set("issuedTo", ""); return; }
    if (v === "__custom__") { setIssuedToPick("__custom__"); return; }
    const w = workers.find((x) => x.id === v);
    if (w) { setIssuedToPick(v); set("issuedTo", permitPersonLabel(w) || w.name); }
  };
  const onIssuedBySelect = (e) => {
    const v = e.target.value;
    if (v === "") { setIssuedByPick(""); set("issuedBy", ""); return; }
    if (v === "__custom__") { setIssuedByPick("__custom__"); return; }
    const w = workers.find((x) => x.id === v);
    if (w) { setIssuedByPick(v); set("issuedBy", permitPersonLabel(w) || w.name); }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setForm(f=>({...f, type:newType, checklist:initChecklist(newType)}));
  };

  const checkCount = Object.values(form.checklist).filter(Boolean).length;
  const totalChecks = PERMIT_TYPES[type]?.checklist?.length || 0;
  const allChecked = checkCount === totalChecks;

  return (
    <div style={{ minHeight:700, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem", overflowY:"auto" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:600 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontWeight:500, fontSize:16 }}>{permit ? "Edit permit" : "Issue permit to work"}</div>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {/* permit type selector */}
        {!permit && (
          <div style={{ marginBottom:16 }}>
            <label style={ss.lbl}>Permit type</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:6 }}>
              {Object.entries(PERMIT_TYPES).map(([k,v])=>(
                <button key={k} type="button" onClick={()=>handleTypeChange(k)} style={{
                  padding:"8px 10px", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
                  textAlign:"left", lineHeight:1.3, display:"flex", alignItems:"center", gap:8,
                  background: type===k ? v.bg : "var(--color-background-secondary,#f7f7f5)",
                  border: type===k ? `1.5px solid ${v.color}` : "0.5px solid var(--color-border-secondary,#ccc)",
                  color: type===k ? v.color : "var(--color-text-primary)",
                }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={type===k?v.color:"currentColor"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                    <path d={v.icon}/>
                  </svg>
                  <span style={{ fontWeight:type===k?500:400 }}>{v.label}</span>
                </button>
              ))}
            </div>
            {def?.description && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:8, padding:"6px 10px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6 }}>{def.description}</div>}
          </div>
        )}

        {/* core fields */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Description of work</label>
            <textarea value={form.description||""} onChange={e=>set("description",e.target.value)} rows={2}
              placeholder="Describe the specific work to be carried out under this permit…" style={{ ...ss.ta, minHeight:50 }} />
          </div>
          <div>
            <label style={ss.lbl}>Location</label>
            <input value={form.location||""} onChange={e=>set("location",e.target.value)} placeholder="Where will work be carried out?" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Project</label>
            <select value={form.projectId||""} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
              <option value="">— Select project —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Permit issued to</label>
            {workers.length > 0 ? (
              <>
                <select value={issuedToPick} onChange={onIssuedToSelect} style={{ ...ss.inp, marginBottom: issuedToPick === "__custom__" ? 8 : 0 }}>
                  <option value="">— Select from my workers —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {permitPersonLabel(w) || w.name}
                    </option>
                  ))}
                  <option value="__custom__">Other (type name)</option>
                </select>
                {issuedToPick === "__custom__" && (
                  <input value={form.issuedTo || ""} onChange={(e) => set("issuedTo", e.target.value)} placeholder="Name of person receiving permit" style={ss.inp} />
                )}
              </>
            ) : (
              <input value={form.issuedTo || ""} onChange={(e) => set("issuedTo", e.target.value)} placeholder="Name of person receiving permit" style={ss.inp} />
            )}
          </div>
          <div>
            <label style={ss.lbl}>Issued by (authorised person)</label>
            {workers.length > 0 ? (
              <>
                <select value={issuedByPick} onChange={onIssuedBySelect} style={{ ...ss.inp, marginBottom: issuedByPick === "__custom__" ? 8 : 0 }}>
                  <option value="">— Select from my workers —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {permitPersonLabel(w) || w.name}
                    </option>
                  ))}
                  <option value="__custom__">Other (type name)</option>
                </select>
                {issuedByPick === "__custom__" && (
                  <input value={form.issuedBy || ""} onChange={(e) => set("issuedBy", e.target.value)} placeholder="Authorised person name" style={ss.inp} />
                )}
              </>
            ) : (
              <input value={form.issuedBy || ""} onChange={(e) => set("issuedBy", e.target.value)} placeholder="Authorised person name" style={ss.inp} />
            )}
          </div>
          <div>
            <label style={ss.lbl}>Start date / time</label>
            <input type="datetime-local" value={toLocalInput(form.startDateTime)} onChange={e=>set("startDateTime",new Date(e.target.value).toISOString())} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Expiry date / time</label>
            <input type="datetime-local" value={toLocalInput(form.endDateTime)} onChange={e=>set("endDateTime",new Date(e.target.value).toISOString())} style={ss.inp} />
          </div>
        </div>

        {/* type-specific extra fields */}
        {def?.extraFields?.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>
              {def.label} — specific information
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
              {def.extraFields.map(f=>(
                <div key={f.key}>
                  <label style={ss.lbl}>{f.label}</label>
                  <input type={f.type||"text"} value={form.extraFields?.[f.key]||""} onChange={e=>setExtra(f.key,e.target.value)} style={ss.inp} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* checklist */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>
              Pre-work checklist
            </div>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20,
              background:allChecked?"#EAF3DE":"#FAEEDA",
              color:allChecked?"#27500A":"#633806" }}>
              {checkCount}/{totalChecks}
            </span>
          </div>
          <div style={{ height:3, background:"var(--color-border-tertiary,#e5e5e5)", borderRadius:2, marginBottom:12 }}>
            <div style={{ height:3, borderRadius:2, background:allChecked?"#1D9E75":"#0d9488", transition:"width .3s",
              width:`${totalChecks>0?(checkCount/totalChecks)*100:0}%` }} />
          </div>
          {(def?.checklist||[]).map((item,i)=>(
            <label key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"7px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", cursor:"pointer" }}>
              <input type="checkbox" checked={!!form.checklist[i]} onChange={e=>setCheck(i,e.target.checked)}
                style={{ marginTop:2, accentColor:"#0d9488", width:15, height:15, flexShrink:0 }} />
              <span style={{ fontSize:13, lineHeight:1.5 }}>{item}</span>
            </label>
          ))}
        </div>

        {/* notes */}
        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Additional conditions / notes</label>
          <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} rows={2}
            placeholder="Any specific conditions, restrictions or additional requirements…" style={{ ...ss.ta, minHeight:50 }} />
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"space-between" }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            <button onClick={()=>onSave({...form,status:"draft"})} style={ss.btn}>Save as draft</button>
            <button onClick={()=>onSave({...form,status:"active"})} style={ss.btnO}>
              Issue permit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Permit card ──────────────────────────────────────────────────────────────
function PermitCard({ permit, onEdit, onClose, onReopen, onDelete, onPrint }) {
  const def = PERMIT_TYPES[permit.type] || PERMIT_TYPES.general;
  const [expanded, setExpanded] = useState(false);

  const checkedCount = Object.values(permit.checklist||{}).filter(Boolean).length;
  const totalChecks = def.checklist?.length||0;
  const isExpired = permit.endDateTime && new Date(permit.endDateTime) < new Date();
  const statusLabel = permit.status==="closed" ? "Closed" : isExpired ? "Expired" : permit.status==="draft" ? "Draft" : "Active";
  const statusBg = permit.status==="closed"?"var(--color-background-secondary,#f7f7f5)":isExpired?"#FCEBEB":permit.status==="draft"?"#FAEEDA":"#EAF3DE";
  const statusColor = permit.status==="closed"?"var(--color-text-secondary)":isExpired?"#791F1F":permit.status==="draft"?"#633806":"#27500A";

  return (
    <div className="app-surface-card" style={{ ...ss.card, marginBottom:8, borderLeft:`3px solid ${def.color}` }}>
      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
        {/* icon */}
        <div style={{ width:36, height:36, borderRadius:8, background:def.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={def.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d={def.icon}/>
          </svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
            <span style={{ fontWeight:500, fontSize:14 }}>{def.label}</span>
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:statusBg, color:statusColor }}>
              {statusLabel}
            </span>
            {permit.status==="active" && !isExpired && permit.endDateTime && (
              <Countdown expiresAt={permit.endDateTime} />
            )}
          </div>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
            {permit.location && <span>{permit.location}</span>}
            {permit.issuedTo && <span>To: {permit.issuedTo}</span>}
            <span>Valid: {fmtDateTime(permit.startDateTime)} → {fmtDateTime(permit.endDateTime)}</span>
          </div>
          {permit.description && (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:4, fontStyle:"italic" }}>
              {permit.description.slice(0,100)}{permit.description.length>100?"…":""}
            </div>
          )}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0, justifyContent:"flex-end" }}>
          <button onClick={()=>setExpanded(v=>!v)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>
            {expanded?"▲":"▼"}
          </button>
          <button onClick={()=>onPrint(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>Print</button>
          <button onClick={()=>onEdit(permit)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Edit</button>
          {permit.status==="active" && (
            <button onClick={()=>onClose(permit.id)} style={{ ...ss.btnR, padding:"4px 10px", fontSize:12 }}>Close</button>
          )}
          {(permit.status==="closed"||isExpired) && (
            <button onClick={()=>onReopen(permit.id)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Reopen</button>
          )}
          <button onClick={()=>onDelete(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          {/* checklist */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:6 }}>
              Checklist: {checkedCount}/{totalChecks} items confirmed
            </div>
            {(def.checklist||[]).map((item,i)=>(
              <div key={i} style={{ display:"flex", gap:8, fontSize:12, padding:"4px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", alignItems:"flex-start" }}>
                <div style={{ width:14, height:14, borderRadius:3, border:`1.5px solid ${permit.checklist?.[i]?"#1D9E75":"var(--color-border-secondary,#ccc)"}`, background:permit.checklist?.[i]?"#1D9E75":"transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {permit.checklist?.[i] && <svg width={8} height={8} viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth={1.5} fill="none"/></svg>}
                </div>
                <span style={{ color:permit.checklist?.[i]?"var(--color-text-primary)":"var(--color-text-secondary)" }}>{item}</span>
              </div>
            ))}
          </div>

          {/* extra fields */}
          {Object.entries(permit.extraFields||{}).filter(([,v])=>v).length>0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8, marginBottom:12 }}>
              {(def.extraFields||[]).filter(f=>permit.extraFields?.[f.key]).map(f=>(
                <div key={f.key} style={{ background:"var(--color-background-secondary,#f7f7f5)", padding:"6px 8px", borderRadius:6 }}>
                  <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{f.label}</div>
                  <div style={{ fontSize:12, fontWeight:500 }}>{permit.extraFields[f.key]}</div>
                </div>
              ))}
            </div>
          )}

          {permit.notes && (
            <div style={{ padding:"6px 10px", background:"#FAEEDA", borderRadius:6, fontSize:12, color:"#633806" }}>
              Conditions: {permit.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Print permit ─────────────────────────────────────────────────────────────
function printPermit(permit) {
  const def = PERMIT_TYPES[permit.type] || PERMIT_TYPES.general;
  const org = (() => { try { return JSON.parse(localStorage.getItem("mysafeops_org_settings")||"{}"); } catch { return {}; } })();
  const checkedCount = Object.values(permit.checklist||{}).filter(Boolean).length;

  const checklistHTML = (def.checklist||[]).map((item,i) => `
    <tr>
      <td style="padding:5px 8px;border:1px solid #ddd;width:30px;text-align:center">
        <span style="font-size:14px;color:${permit.checklist?.[i]?"#27500A":"#ccc"}">${permit.checklist?.[i]?"✓":"○"}</span>
      </td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-size:12px;color:${permit.checklist?.[i]?"#000":"#888"}">${item}</td>
    </tr>`).join("");

  const extraHTML = (def.extraFields||[]).filter(f=>permit.extraFields?.[f.key]).map(f=>`
    <tr>
      <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666;width:40%">${f.label}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px">${permit.extraFields[f.key]}</td>
    </tr>`).join("");

  const win = window.open("","_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>PTW — ${def.label}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:20px}
    .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${def.color};padding-bottom:10px;margin-bottom:14px}
    .ptw-type{background:${def.bg};color:${def.color};padding:6px 14px;border-radius:6px;font-weight:bold;font-size:14px}
    h2{font-size:12px;background:#f5f5f5;padding:4px 8px;margin:12px 0 6px;font-weight:bold}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:#0f172a;color:#fff;padding:5px 8px;font-size:11px;text-align:left}
    .sig-box{height:50px;border:1px solid #ddd;border-radius:4px}
    @media print{.header,.ptw-type{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:14px">
      ${org.logo?`<img src="${org.logo}" style="height:44px;max-width:120px;object-fit:contain"/>`:""}
      <div>
        <div style="font-weight:bold;font-size:14px">${org.name||"MySafeOps"}</div>
        <div style="font-size:11px;color:#666">PERMIT TO WORK</div>
      </div>
    </div>
    <div class="ptw-type">${def.label}</div>
  </div>
  <table>
    <tr><td style="padding:4px 8px;border:1px solid #ddd;width:30%;font-size:11px;color:#666">Work description</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:12px" colspan="3">${permit.description||"—"}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Location</td><td style="padding:4px 8px;border:1px solid #ddd">${permit.location||"—"}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Issued to</td><td style="padding:4px 8px;border:1px solid #ddd">${permit.issuedTo||"—"}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Start</td><td style="padding:4px 8px;border:1px solid #ddd">${fmtDateTime(permit.startDateTime)}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Expiry</td><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold">${fmtDateTime(permit.endDateTime)}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Issued by</td><td style="padding:4px 8px;border:1px solid #ddd">${permit.issuedBy||"—"}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;color:#666">Permit No.</td><td style="padding:4px 8px;border:1px solid #ddd;font-family:monospace;font-size:11px">${permit.id}</td></tr>
    ${extraHTML}
  </table>
  <h2>Pre-work checklist (${checkedCount}/${def.checklist?.length||0} confirmed)</h2>
  <table><tbody>${checklistHTML}</tbody></table>
  ${permit.notes?`<h2>Conditions / restrictions</h2><p style="font-size:12px;line-height:1.6;padding:6px 8px;background:#fff8e6;border:0.5px solid #e5c060">${permit.notes}</p>`:""}
  <h2>Signatures</h2>
  <table>
    <tr><th>Role</th><th>Name</th><th>Signature</th><th>Date/Time</th></tr>
    <tr style="height:48px"><td style="padding:6px;border:1px solid #ddd">Issued by (Authorised Person)</td><td style="padding:6px;border:1px solid #ddd">${permit.issuedBy||""}</td><td style="border:1px solid #ddd"></td><td style="border:1px solid #ddd"></td></tr>
    <tr style="height:48px"><td style="padding:6px;border:1px solid #ddd">Received by (Permit holder)</td><td style="padding:6px;border:1px solid #ddd">${permit.issuedTo||""}</td><td style="border:1px solid #ddd"></td><td style="border:1px solid #ddd"></td></tr>
    <tr style="height:48px"><td style="padding:6px;border:1px solid #ddd">Permit closed by</td><td style="border:1px solid #ddd"></td><td style="border:1px solid #ddd"></td><td style="border:1px solid #ddd"></td></tr>
  </table>
  <p style="font-size:10px;color:#999;margin-top:16px">${org.pdfFooter||"Generated by MySafeOps · mysafeops.com"} · ${fmtDateTime(permit.createdAt)}</p>
  </body></html>`);
  win.document.close(); win.print();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PermitSystem() {
  const [permits, setPermits] = useState(()=>load("permits_v2",[]));
  const [modal, setModal] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [search, setSearch] = useState("");

  useEffect(()=>{ save("permits_v2",permits); },[permits]);

  const savePermit = (p) => {
    setPermits(prev=>prev.find(x=>x.id===p.id)?prev.map(x=>x.id===p.id?p:x):[p,...prev]);
    setModal(null);
  };

  const closePermit = (id) => setPermits(prev=>prev.map(p=>p.id===id?{...p,status:"closed",closedAt:new Date().toISOString()}:p));
  const reopenPermit = (id) => setPermits(prev=>prev.map(p=>p.id===id?{...p,status:"active",closedAt:undefined}:p));
  const deletePermit = (id) => { if(confirm("Delete this permit?")) setPermits(prev=>prev.filter(p=>p.id!==id)); };

  const now = new Date();
  const filtered = permits.filter(p=>{
    if (filterType && p.type!==filterType) return false;
    if (filterStatus==="active" && (p.status!=="active" || new Date(p.endDateTime)<now)) return false;
    if (filterStatus==="expired" && !(p.status==="active"&&new Date(p.endDateTime)<now)) return false;
    if (filterStatus==="closed" && p.status!=="closed") return false;
    if (filterStatus==="draft" && p.status!=="draft") return false;
    if (search && !p.location?.toLowerCase().includes(search.toLowerCase()) && !p.description?.toLowerCase().includes(search.toLowerCase()) && !p.issuedTo?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    active: permits.filter(p=>p.status==="active"&&new Date(p.endDateTime)>now).length,
    expiring: permits.filter(p=>p.status==="active"&&new Date(p.endDateTime)>now&&(new Date(p.endDateTime)-now)<7200000).length,
    expired: permits.filter(p=>p.status==="active"&&new Date(p.endDateTime)<now).length,
    closed: permits.filter(p=>p.status==="closed").length,
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {modal?.type==="form" && <PermitForm permit={modal.data} onSave={savePermit} onClose={()=>setModal(null)} />}

      <PageHero
        badgeText="PTW"
        title="Permits to work"
        lead="Fifteen permit types, live countdown timers, and full pre-work checklists. Data stays in this browser unless you use cloud backup."
        right={<button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnO}>+ Issue permit</button>}
      />

      {/* stat cards */}
      {permits.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:8, marginBottom:20 }}>
          {[
            { label:"Active", value:stats.active, bg:"#EAF3DE", color:"#27500A", filter:"active" },
            { label:"Expiring soon", value:stats.expiring, bg:"#FAEEDA", color:"#633806", filter:"active" },
            { label:"Expired", value:stats.expired, bg:"#FCEBEB", color:"#791F1F", filter:"expired" },
            { label:"Closed", value:stats.closed, bg:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)", filter:"closed" },
          ].map(c=>(
            <div
              key={c.label}
              role="button"
              tabIndex={0}
              className="app-permit-stat-tile"
              onClick={()=>setFilterStatus(c.filter)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilterStatus(c.filter);
                }
              }}
              style={{ background:c.bg, borderRadius:8, padding:"10px 12px", cursor:"pointer" }}
            >
              <div style={{ fontSize:11, color:c.color, fontWeight:500, marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:500, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search location, worker…" style={{ ...ss.inp, flex:1, width:"auto", minWidth:140 }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All permit types</option>
          {Object.entries(PERMIT_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="closed">Closed</option>
          <option value="draft">Draft</option>
        </select>
        {(search||filterType||filterStatus)&&<button type="button" onClick={()=>{setSearch("");setFilterType("");setFilterStatus("");}} style={{ ...ss.btn, fontSize:12 }}>Clear</button>}
      </div>

      {permits.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No permits issued yet.</p>
          <button type="button" onClick={()=>setModal({type:"form"})} style={ss.btnO}>+ Issue first permit</button>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, color:"var(--color-text-secondary)", fontSize:13 }}>
          No permits match your filters.
        </div>
      ) : (
        filtered.map(p=>(
          <PermitCard key={p.id} permit={p}
            onEdit={p=>setModal({type:"form",data:p})}
            onClose={closePermit} onReopen={reopenPermit}
            onDelete={deletePermit} onPrint={printPermit}
          />
        ))
      )}
    </div>
  );
}
