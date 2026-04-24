import { useState, useEffect, useRef } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";

const genId = () => `brief_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" }); };
const fmtTime = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" }); };
const fmtDateTime = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); };

const workerConductLabel = (w) => `${w.name || ""}${w.role ? ` — ${w.role}` : ""}`.trim();

const BRIEF_TOPICS = [
  "Weather conditions and site-specific hazards for today",
  "PPE requirements for today's tasks",
  "Permit to work status and any active permits",
  "Emergency evacuation procedure and muster point reminder",
  "Housekeeping standards — keep work area clean and tidy",
  "Toolbox talk reference (if applicable)",
  "Any near misses or incidents from previous shift",
  "Visitor or third-party contractor on site today",
  "Specific hazards for today's scope of work",
  "First aid facilities and first aider location",
];

const ss = {
  ...ms,
  btnO: { padding:"10px 14px", borderRadius:6, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  ta:   { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", lineHeight:1.5 },
};

// ─── Signature canvas ─────────────────────────────────────────────────────────
function SigCanvas({ onCapture, compact }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [has, setHas] = useState(false);
  const h = compact ? 80 : 120;

  const getPos = (e, c) => {
    const r = c.getBoundingClientRect(), sx = c.width/r.width, sy = c.height/r.height;
    if (e.touches) return { x:(e.touches[0].clientX-r.left)*sx, y:(e.touches[0].clientY-r.top)*sy };
    return { x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy };
  };
  const start = (e) => { e.preventDefault(); drawing.current=true; const c=ref.current, p=getPos(e,c); last.current=p; const ctx=c.getContext("2d"); ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2); ctx.fillStyle="#0f172a"; ctx.fill(); setHas(true); };
  const move = (e) => { if(!drawing.current) return; e.preventDefault(); const c=ref.current, ctx=c.getContext("2d"), p=getPos(e,c); ctx.beginPath(); ctx.moveTo(last.current.x,last.current.y); ctx.lineTo(p.x,p.y); ctx.strokeStyle="#0f172a"; ctx.lineWidth=2; ctx.lineCap="round"; ctx.stroke(); last.current=p; };
  const stop = () => { drawing.current=false; };

  useEffect(()=>{
    const c=ref.current;
    c.addEventListener("touchstart",start,{passive:false});
    c.addEventListener("touchmove",move,{passive:false});
    c.addEventListener("touchend",stop);
    return ()=>{ c.removeEventListener("touchstart",start); c.removeEventListener("touchmove",move); c.removeEventListener("touchend",stop); };
  },[]);

  const clear = () => { ref.current.getContext("2d").clearRect(0,0,500,160); setHas(false); };

  return (
    <div>
      <div style={{ position:"relative", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, background:"#fff", overflow:"hidden" }}>
        <canvas ref={ref} width={500} height={160} onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          style={{ width:"100%", height:h, display:"block", cursor:"crosshair", touchAction:"none" }} />
        {!has && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <span style={{ color:"#ccc", fontSize:12, fontStyle:"italic" }}>Sign here</span>
        </div>}
        <div style={{ position:"absolute", bottom:5, left:8, right:8, borderTop:"0.5px solid #e5e5e5", pointerEvents:"none" }} />
      </div>
      <div style={{ display:"flex", gap:6, marginTop:4 }}>
        <button onClick={clear} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>Clear</button>
        <button disabled={!has} onClick={()=>has&&onCapture(ref.current.toDataURL("image/png"))}
          style={{ ...ss.btnP, fontSize:11, padding:"3px 10px", opacity:has?1:0.4 }}>Confirm</button>
      </div>
    </div>
  );
}

// ─── New briefing form ────────────────────────────────────────────────────────
function BriefingForm({ onSave, onClose, workers, projects }) {

  const [form, setForm] = useState({
    date: today(), time: new Date().toTimeString().slice(0,5),
    location: "", projectId: "", conductedBy: "",
    weatherConditions: "", temperature: "",
    topics: [], customTopics: "",
    scopeToday: "",
    attendees: workers.map(w=>({ id:w.id, name:w.name, role:w.role||"", present:false, sig:null, sigTime:null })),
    notes: "",
    createdAt: new Date().toISOString(),
  });

  const [conductPick, setConductPick] = useState("");
  const [workerAddSelect, setWorkerAddSelect] = useState("");
  const [guestName, setGuestName] = useState("");

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleTopic = (t) => set("topics", form.topics.includes(t) ? form.topics.filter(x=>x!==t) : [...form.topics,t]);
  const toggleAttendee = (id) => set("attendees", form.attendees.map(a=>a.id===id?{...a,present:!a.present,sig:null}:a));
  const addWorkerFromSelect = (workerId) => {
    if (!workerId) return;
    const w = workers.find((x) => x.id === workerId);
    if (!w || form.attendees.some((a) => a.id === w.id)) return;
    set("attendees", [
      ...form.attendees,
      { id: w.id, name: w.name, role: w.role || "", present: true, sig: null, sigTime: null, external: false },
    ]);
    setWorkerAddSelect("");
  };
  const addGuestAttendee = () => {
    const name = guestName.trim();
    if (!name) return;
    set("attendees", [
      ...form.attendees,
      { id: genId(), name, role: "", present: true, sig: null, sigTime: null, external: true },
    ]);
    setGuestName("");
  };
  const onConductSelect = (e) => {
    const v = e.target.value;
    if (v === "") {
      setConductPick("");
      set("conductedBy", "");
      return;
    }
    if (v === "__custom__") {
      setConductPick("__custom__");
      return;
    }
    const w = workers.find((x) => x.id === v);
    if (w) {
      setConductPick(v);
      set("conductedBy", workerConductLabel(w));
    }
  };
  const setAttSig = (id, dataUrl) => set("attendees", form.attendees.map(a=>a.id===id?{...a,sig:dataUrl,sigTime:new Date().toISOString()}:a));
  const [signingId, setSigningId] = useState(null);

  const presentCount = form.attendees.filter(a=>a.present).length;
  const signedCount = form.attendees.filter(a=>a.sig).length;
  const valid = form.location?.trim() && form.conductedBy?.trim() && presentCount > 0;

  return (
    <div style={{ minHeight:600, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:620 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:500, fontSize:16 }}>New daily briefing</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>Pre-work safety briefing record</div>
          </div>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {/* section: details */}
        <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Briefing details</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:16 }}>
          <div>
            <label style={ss.lbl}>Date</label>
            <input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Time</label>
            <input type="time" value={form.time} onChange={e=>set("time",e.target.value)} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Location / site *</label>
            <input value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. 2SFG Scunthorpe — FP1 area" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Project</label>
            <select value={form.projectId} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
              <option value="">— Select project —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Briefing conducted by *</label>
            {workers.length > 0 ? (
              <>
                <select value={conductPick} onChange={onConductSelect} style={{ ...ss.inp, marginBottom: conductPick === "__custom__" ? 8 : 0 }}>
                  <option value="">— Select from my workers —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {workerConductLabel(w) || w.name || w.id}
                    </option>
                  ))}
                  <option value="__custom__">Other (type name and role)</option>
                </select>
                {conductPick === "__custom__" && (
                  <input
                    value={form.conductedBy}
                    onChange={(e) => set("conductedBy", e.target.value)}
                    placeholder="Name and role of person conducting the briefing"
                    style={ss.inp}
                  />
                )}
              </>
            ) : (
              <input
                value={form.conductedBy}
                onChange={(e) => set("conductedBy", e.target.value)}
                placeholder="Name and role — add workers in Workers module to pick from a list"
                style={ss.inp}
              />
            )}
          </div>
        </div>

        {/* section: weather */}
        <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Conditions</div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:16 }}>
          <div>
            <label style={ss.lbl}>Weather conditions</label>
            <select value={form.weatherConditions} onChange={e=>set("weatherConditions",e.target.value)} style={ss.inp}>
              <option value="">— Select —</option>
              {["Dry and sunny","Dry and overcast","Light rain","Heavy rain","Fog/mist","Frosty/icy","Snow","High winds","Hot (>25°C)","Cold (<5°C)"].map(w=><option key={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Temperature (°C)</label>
            <input value={form.temperature} onChange={e=>set("temperature",e.target.value)} placeholder="e.g. 12" type="number" style={ss.inp} />
          </div>
        </div>

        {/* section: scope */}
        <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Today's scope</div>
        <div style={{ marginBottom:16 }}>
          <textarea value={form.scopeToday} onChange={e=>set("scopeToday",e.target.value)} rows={2}
            placeholder="What is the planned scope of work for today?" style={{ ...ss.ta, minHeight:50 }} />
        </div>

        {/* section: topics */}
        <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Topics covered</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:8 }}>
          {BRIEF_TOPICS.map(t=>(
            <label key={t} style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", fontSize:13 }}>
              <input type="checkbox" checked={form.topics.includes(t)} onChange={()=>toggleTopic(t)}
                style={{ marginTop:2, accentColor:"#0d9488", width:15, height:15, flexShrink:0 }} />
              <span style={{ lineHeight:1.5, color:"var(--color-text-primary)" }}>{t}</span>
            </label>
          ))}
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Additional topics / notes on topics covered</label>
          <textarea value={form.customTopics} onChange={e=>set("customTopics",e.target.value)} rows={2}
            placeholder="Any additional topics discussed today…" style={{ ...ss.ta, minHeight:50 }} />
        </div>

        {/* section: attendees */}
        <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>
          Attendance & signatures
          <span style={{ marginLeft:8, padding:"1px 8px", borderRadius:20, fontSize:11, background:"#E6F1FB", color:"#0C447C", fontWeight:400, textTransform:"none" }}>
            {signedCount}/{presentCount} signed
          </span>
        </div>

        <div style={{ marginBottom:16 }}>
          {form.attendees.length === 0 && (
            <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:8 }}>
              No workers in system yet. Add attendees manually below.
            </div>
          )}
          {form.attendees.map(a=>(
            <div key={a.id} style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:a.present&&!a.sig&&signingId===a.id?10:0 }}>
                <input type="checkbox" checked={a.present} onChange={()=>toggleAttendee(a.id)}
                  style={{ accentColor:"#0d9488", width:15, height:15, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:13 }}>{a.name}</div>
                  {a.role && <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{a.role}</div>}
                </div>
                {a.present && !a.sig && (
                  <button onClick={()=>setSigningId(signingId===a.id?null:a.id)}
                    style={{ ...ss.btnP, fontSize:12, padding:"4px 10px" }}>
                    {signingId===a.id?"Cancel":"Sign"}
                  </button>
                )}
                {a.sig && (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <img src={a.sig} alt="sig" style={{ height:32, width:80, objectFit:"contain", border:"0.5px solid #e5e5e5", borderRadius:4, background:"#fff" }} />
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{fmtTime(a.sigTime)}</div>
                    <button onClick={()=>set("attendees",form.attendees.map(x=>x.id===a.id?{...x,sig:null,sigTime:null}:x))}
                      style={{ ...ss.btn, padding:"2px 6px", fontSize:11 }}>×</button>
                  </div>
                )}
              </div>
              {a.present && signingId===a.id && !a.sig && (
                <SigCanvas compact onCapture={(d)=>{ setAttSig(a.id,d); setSigningId(null); }} />
              )}
            </div>
          ))}
          {workers.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <select
                value={workerAddSelect}
                onChange={(e) => addWorkerFromSelect(e.target.value)}
                style={{ ...ss.inp, flex: "1 1 220px", minWidth: 0 }}
              >
                <option value="">— Add participant from my workers —</option>
                {workers
                  .filter((w) => !form.attendees.some((a) => a.id === w.id))
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {workerConductLabel(w) || w.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuestAttendee())}
              placeholder="Guest or subcontractor name"
              style={{ ...ss.inp, flex: "1 1 200px", minWidth: 0 }}
            />
            <button type="button" onClick={addGuestAttendee} disabled={!guestName.trim()} style={{ ...ss.btn, fontSize: 12, opacity: guestName.trim() ? 1 : 0.45 }}>
              + Add guest
            </button>
          </div>
        </div>

        {/* notes */}
        <div style={{ marginBottom:20 }}>
          <label style={ss.lbl}>Additional notes / actions</label>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2}
            placeholder="Any actions raised, issues noted, or follow-up required…" style={{ ...ss.ta, minHeight:50 }} />
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <button disabled={!valid} onClick={()=>onSave(form)} style={{ ...ss.btnO, opacity:valid?1:0.4 }}>
            Save briefing record
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Briefing card ────────────────────────────────────────────────────────────
function BriefingCard({ brief, onDelete, onPrint }) {
  const [expanded, setExpanded] = useState(false);
  const presentCount = brief.attendees?.filter(a=>a.present).length || 0;
  const signedCount = brief.attendees?.filter(a=>a.sig).length || 0;
  const todayStr = today();
  const isToday = brief.date === todayStr;

  return (
    <div style={{ ...ss.card, marginBottom:8 }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-start", cursor:"pointer" }} onClick={()=>setExpanded(v=>!v)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
            <span style={{ fontWeight:500, fontSize:14 }}>{brief.location}</span>
            {isToday && <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:"#EAF3DE", color:"#27500A" }}>Today</span>}
            <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{fmtDate(brief.date)} · {brief.time}</span>
          </div>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
            {brief.conductedBy && <span>By: {brief.conductedBy}</span>}
            <span>{presentCount} attended · {signedCount} signed</span>
            <span>{brief.topics?.length||0} topics</span>
            {brief.weatherConditions && <span>{brief.weatherConditions}{brief.temperature?` · ${brief.temperature}°C`:""}</span>}
          </div>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0 }}>
          <button onClick={e=>{e.stopPropagation();onPrint(brief);}} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Print</button>
          <button onClick={e=>{e.stopPropagation();onDelete(brief.id);}} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
          <span style={{ fontSize:18, color:"var(--color-text-secondary)", paddingTop:2 }}>{expanded?"▲":"▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          {brief.scopeToday && (
            <div style={{ marginBottom:12 }}>
              <div style={ss.lbl}>Today's scope</div>
              <div style={{ fontSize:13, lineHeight:1.6 }}>{brief.scopeToday}</div>
            </div>
          )}
          {brief.topics?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={ss.lbl}>Topics covered</div>
              <ul style={{ margin:0, paddingLeft:16, fontSize:12, lineHeight:1.8, color:"var(--color-text-primary)" }}>
                {brief.topics.map((t,i)=><li key={i}>{t}</li>)}
                {brief.customTopics && <li style={{ fontStyle:"italic" }}>{brief.customTopics}</li>}
              </ul>
            </div>
          )}
          <div style={{ marginBottom:brief.notes?12:0 }}>
            <div style={ss.lbl}>Attendance</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {brief.attendees?.filter(a=>a.present).map(a=>(
                <div key={a.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, background:a.sig?"#EAF3DE":"var(--color-background-secondary,#f7f7f5)", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  <span style={{ fontSize:12, color:a.sig?"#27500A":"var(--color-text-primary)" }}>{a.name}</span>
                  {a.sig && <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="#27500A" strokeWidth={1.5} strokeLinecap="round"/></svg>}
                </div>
              ))}
            </div>
          </div>
          {brief.notes && (
            <div style={{ marginTop:12, padding:"8px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6, fontSize:12, lineHeight:1.6 }}>
              <strong>Notes: </strong>{brief.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Print briefing ───────────────────────────────────────────────────────────
function printBriefing(brief) {
  const win = window.open("","_blank");
  const topicsHTML = (brief.topics||[]).map(t=>`<li>${t}</li>`).join("");
  const customTopicHTML = brief.customTopics ? `<li><em>${brief.customTopics}</em></li>` : "";
  const attendeeRows = (brief.attendees||[]).filter(a=>a.present).map(a=>`
    <tr style="height:48px">
      <td style="padding:6px;border:1px solid #ccc;font-size:12px">${a.name}</td>
      <td style="padding:6px;border:1px solid #ccc;font-size:11px">${a.role||""}</td>
      <td style="padding:6px;border:1px solid #ccc">${a.sig?`<img src="${a.sig}" style="height:36px;max-width:140px;object-fit:contain"/>`:""}</td>
      <td style="padding:6px;border:1px solid #ccc;font-size:11px">${a.sigTime?new Date(a.sigTime).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):""}</td>
    </tr>`).join("");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Daily Briefing — ${brief.location} — ${brief.date}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:20px;color:#000}
    h1{font-size:15px;font-weight:bold;background:#0d9488;color:#fff;padding:8px 12px;margin:0 0 12px}
    .hdr{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px}
    .hdr-cell{border:0.5px solid #ccc;padding:6px 8px}
    .hdr-cell .lbl{font-size:10px;color:#666;font-weight:bold;margin-bottom:2px}
    .section{font-weight:bold;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px}
    ul{margin:0;padding-left:16px;line-height:1.8}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:#f5f5f5;padding:6px 8px;font-size:11px;text-align:left;border:1px solid #ccc}
    @media print{body{padding:10px}h1{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <h1>Daily Safety Briefing Record — MySafeOps</h1>
  <div class="hdr">
    <div class="hdr-cell"><div class="lbl">Location</div>${brief.location}</div>
    <div class="hdr-cell"><div class="lbl">Date</div>${fmtDate(brief.date)}</div>
    <div class="hdr-cell"><div class="lbl">Time</div>${brief.time}</div>
    <div class="hdr-cell"><div class="lbl">Conducted by</div>${brief.conductedBy||"—"}</div>
  </div>
  ${brief.weatherConditions?`<div class="hdr-cell" style="margin-bottom:12px;border:0.5px solid #ccc;padding:6px 8px"><div class="lbl">Weather</div>${brief.weatherConditions}${brief.temperature?` · ${brief.temperature}°C`:""}</div>`:""}
  ${brief.scopeToday?`<div class="section">Today's scope</div><p style="font-size:12px;line-height:1.6;margin:0 0 12px">${brief.scopeToday}</p>`:""}
  <div class="section">Topics covered</div>
  <ul style="margin-bottom:12px">${topicsHTML}${customTopicHTML}</ul>
  ${brief.notes?`<div class="section">Notes / actions</div><p style="font-size:12px;line-height:1.6;margin:0 0 12px;padding:8px;background:#f9f9f9;border:0.5px solid #ccc">${brief.notes}</p>`:""}
  <div class="section">Attendance &amp; signatures</div>
  <table>
    <thead><tr><th style="width:30%">Name</th><th style="width:20%">Role</th><th style="width:35%">Signature</th><th style="width:15%">Time</th></tr></thead>
    <tbody>${attendeeRows}</tbody>
  </table>
  <p style="font-size:10px;color:#888;margin-top:16px">Generated by MySafeOps · ${fmtDateTime(brief.createdAt)}</p>
  </body></html>`);
  win.document.close();
  win.print();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DailyBriefing() {
  const [briefings, setBriefings] = useState(()=>load("daily_briefings",[]));
  const [workers, setWorkers] = useState(() => load("mysafeops_workers", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");

  const { d1Syncing: d1BriefSync } = useD1OrgArraySync({
    storageKey: "daily_briefings",
    namespace: "daily_briefings",
    value: briefings,
    setValue: setBriefings,
    load,
    save,
  });
  const { d1Syncing: d1WpSyncing } = useD1WorkersProjectsSync({
    workers,
    setWorkers,
    projects,
    setProjects,
    load,
    save,
  });
  const d1Syncing = d1BriefSync || d1WpSyncing;

  const saveBriefing = (form) => {
    setBriefings(prev=>[{...form, id:genId()},...prev]);
    setShowForm(false);
  };

  const deleteBriefing = (id) => { if(confirm("Delete this briefing record?")) setBriefings(prev=>prev.filter(b=>b.id!==id)); };

  const todayCount = briefings.filter(b=>b.date===today()).length;
  const totalSigs = briefings.reduce((s,b)=>(b.attendees||[]).filter(a=>a.sig).length+s, 0);

  const filtered = briefings.filter(b=>{
    if (filterDate && b.date!==filterDate) return false;
    if (search && !b.location?.toLowerCase().includes(search.toLowerCase()) && !b.conductedBy?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {d1Syncing ? (
        <div
          className="app-panel-surface"
          style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}
        >
          Syncing briefings and team lists with cloud…
        </div>
      ) : null}
      {showForm && (
        <BriefingForm workers={workers} projects={projects} onSave={saveBriefing} onClose={() => setShowForm(false)} />
      )}

      <PageHero
        badgeText="BR"
        title="Daily briefing record"
        lead="Pre-work safety briefing with attendance and signatures."
        right={<button type="button" onClick={() => setShowForm(true)} style={ss.btnO}>+ New briefing</button>}
      />

      {briefings.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:10, marginBottom:20 }}>
          {[
            { label:"Today's briefings", value:todayCount, bg:"#EAF3DE", color:"#27500A" },
            { label:"Total records", value:briefings.length, bg:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-primary)" },
            { label:"Total signatures", value:totalSigs, bg:"#E6F1FB", color:"#0C447C" },
          ].map(c=>(
            <div key={c.label} style={{ background:c.bg, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:500, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search location or conductor…" style={{ ...ss.inp, flex:1, width:"auto", minWidth:140 }} />
        <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{ ...ss.inp, width:"auto" }} />
        {(search||filterDate) && <button onClick={()=>{setSearch("");setFilterDate("");}} style={{ ...ss.btn, fontSize:12 }}>Clear</button>}
      </div>

      {briefings.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No briefing records yet.</p>
          <button onClick={()=>setShowForm(true)} style={ss.btnO}>+ Record first briefing</button>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, color:"var(--color-text-secondary)", fontSize:13 }}>
          No records match filters.
        </div>
      ) : (
        filtered.map(b=><BriefingCard key={b.id} brief={b} onDelete={deleteBriefing} onPrint={printBriefing} />)
      )}

      <div style={{ marginTop:20, padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        Each briefing records: date/time, location, weather, scope, topics covered, attendees with finger signatures and timestamps. Print-ready A4 PDF with one click.
      </div>
    </div>
  );
}
