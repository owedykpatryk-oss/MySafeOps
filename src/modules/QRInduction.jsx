import { useState, useEffect, useRef, useCallback } from "react";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save, getOrgId } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

// ─── storage ─────────────────────────────────────────────────────────────────
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const fmt = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }); };
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };

const ss = { ...ms, btnO: { padding:"10px 14px", borderRadius:6, border:"0.5px solid #f97316", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 } };

// ─── QR generator (pure JS, no lib) ─────────────────────────────────────────
// Lightweight QR via Google Charts API (no auth needed, public)
function QRCode({ value, size = 180 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=0f172a&margin=8`;
  return (
    <img src={url} alt="QR code" width={size} height={size}
      style={{ borderRadius:8, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", display:"block" }}
      onError={e => { e.target.style.display="none"; }}
    />
  );
}

// ─── Signature canvas (touch + mouse) ────────────────────────────────────────
function SigCanvas({ onCapture }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [has, setHas] = useState(false);

  const pos = (e, c) => {
    const r = c.getBoundingClientRect();
    const sx = c.width/r.width, sy = c.height/r.height;
    if (e.touches) return { x:(e.touches[0].clientX-r.left)*sx, y:(e.touches[0].clientY-r.top)*sy };
    return { x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy };
  };

  const start = useCallback((e) => {
    e.preventDefault(); drawing.current=true;
    const c=ref.current, ctx=c.getContext("2d"), p=pos(e,c);
    last.current=p; ctx.beginPath(); ctx.arc(p.x,p.y,1,0,Math.PI*2);
    ctx.fillStyle="#0f172a"; ctx.fill(); setHas(true);
  },[]);

  const move = useCallback((e) => {
    if (!drawing.current) return; e.preventDefault();
    const c=ref.current, ctx=c.getContext("2d"), p=pos(e,c);
    ctx.beginPath(); ctx.moveTo(last.current.x,last.current.y);
    ctx.lineTo(p.x,p.y); ctx.strokeStyle="#0f172a";
    ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.stroke(); last.current=p;
  },[]);

  const stop = useCallback(()=>{ drawing.current=false; },[]);

  useEffect(()=>{
    const c=ref.current;
    c.addEventListener("touchstart",start,{passive:false});
    c.addEventListener("touchmove",move,{passive:false});
    c.addEventListener("touchend",stop);
    return ()=>{ c.removeEventListener("touchstart",start); c.removeEventListener("touchmove",move); c.removeEventListener("touchend",stop); };
  },[start,move,stop]);

  const clear = () => { ref.current.getContext("2d").clearRect(0,0,600,160); setHas(false); };

  return (
    <div>
      <div style={{ position:"relative", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:8, background:"#fff", overflow:"hidden" }}>
        <canvas ref={ref} width={600} height={160} onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          style={{ width:"100%", height:120, display:"block", cursor:"crosshair", touchAction:"none" }} />
        {!has && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <span style={{ color:"#ccc", fontSize:13, fontStyle:"italic" }}>Sign here with finger or mouse</span>
        </div>}
        <div style={{ position:"absolute", bottom:6, left:10, right:10, borderTop:"1px solid #e5e5e5", pointerEvents:"none" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
        <button onClick={clear} style={{ ...ss.btn, fontSize:12 }}>Clear</button>
        <button disabled={!has} onClick={()=>has&&onCapture(ref.current.toDataURL("image/png"))}
          style={{ ...ss.btnP, opacity:has?1:0.4, fontSize:12 }}>Confirm signature</button>
      </div>
    </div>
  );
}

// ─── Induction form (shown to worker after QR scan) ──────────────────────────
function InductionForm({ site, checklist, onComplete, onBack }) {
  const [step, setStep] = useState(0); // 0=details, 1=checklist, 2=sign, 3=done
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [checked, setChecked] = useState({});
  const [sig, setSig] = useState(null);
  const [gps, setGps] = useState(null);

  const allChecked = checklist.length===0 || checklist.every((_,i)=>checked[i]);

  const handleSign = async (dataUrl) => {
    let g = null;
    if (navigator.geolocation) {
      g = await new Promise(res => navigator.geolocation.getCurrentPosition(
        p=>res({ lat:p.coords.latitude.toFixed(6), lng:p.coords.longitude.toFixed(6), accuracy:Math.round(p.coords.accuracy) }),
        ()=>res(null), { timeout:5000 }
      ));
    }
    setGps(g); setSig(dataUrl);
    onComplete({ id:genId(), name:name.trim(), company:company.trim(), role:role.trim(), sig:dataUrl, gps:g, timestamp:new Date().toISOString(), siteId:site.id, siteName:site.name });
    setStep(3);
  };

  if (step===3) return (
    <div style={{ fontFamily:"DM Sans,sans-serif", maxWidth:480, margin:"0 auto", padding:"2rem 1rem", textAlign:"center" }}>
      <div style={{ width:64, height:64, borderRadius:"50%", background:"#EAF3DE", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1rem" }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#27500A" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={12} r={10}/><path d="M8 12l3 3 5-5"/></svg>
      </div>
      <h2 style={{ fontWeight:500, fontSize:20, color:"var(--color-text-primary)", marginBottom:8 }}>Induction complete</h2>
      <p style={{ fontSize:14, color:"var(--color-text-secondary)", marginBottom:4 }}>Welcome to <strong>{site.name}</strong>, {name}.</p>
      <p style={{ fontSize:13, color:"var(--color-text-secondary)" }}>{fmt(new Date().toISOString())}</p>
      {gps && <p style={{ fontSize:12, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>GPS: {gps.lat}, {gps.lng}</p>}
    </div>
  );

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", maxWidth:480, margin:"0 auto", padding:"1.5rem 1rem" }}>
      {/* site header */}
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ width:48, height:48, borderRadius:10, background:"#0d9488", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#E1F5EE" strokeWidth={2} strokeLinecap="round"><path d="M12 2L3 7v9c0 4 3 6 9 7 6-1 9-3 9-7V7L12 2z"/></svg>
        </div>
        <h2 style={{ fontWeight:500, fontSize:18, color:"var(--color-text-primary)", margin:"0 0 4px" }}>{site.name}</h2>
        <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:0 }}>Site induction — MySafeOps</p>
      </div>

      {/* progress */}
      <div style={{ display:"flex", gap:4, marginBottom:24 }}>
        {["Your details","Safety checklist","Sign & confirm"].map((s,i)=>(
          <div key={i} style={{ flex:1, textAlign:"center" }}>
            <div style={{ height:3, borderRadius:2, background:i<=step-1?"#0d9488":"var(--color-border-tertiary,#e5e5e5)", marginBottom:4 }} />
            <span style={{ fontSize:10, color:i===step?"#0d9488":i<step?"var(--color-text-secondary)":"var(--color-text-tertiary,#aaa)" }}>{s}</span>
          </div>
        ))}
      </div>

      {/* step 0 — details */}
      {step===0 && (
        <div>
          <div style={{ marginBottom:12 }}>
            <label style={ss.lbl}>Full name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" style={ss.inp} />
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={ss.lbl}>Company / employer</label>
            <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Your company name" style={ss.inp} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={ss.lbl}>Role / trade</label>
            <input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Electrician, Engineer, Welder" style={ss.inp} />
          </div>
          <button disabled={!name.trim()} onClick={()=>setStep(1)}
            style={{ ...ss.btnP, width:"100%", justifyContent:"center", opacity:name.trim()?1:0.4 }}>
            Continue →
          </button>
        </div>
      )}

      {/* step 1 — checklist */}
      {step===1 && (
        <div>
          {checklist.length===0 ? (
            <p style={{ fontSize:13, color:"var(--color-text-secondary)", textAlign:"center", padding:"1rem 0" }}>
              No checklist items configured for this site. Continue to sign.
            </p>
          ) : (
            <div style={{ marginBottom:20 }}>
              <p style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:12 }}>
                Please confirm you have been briefed on each of the following:
              </p>
              {checklist.map((item,i)=>(
                <label key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", cursor:"pointer" }}>
                  <input type="checkbox" checked={!!checked[i]} onChange={e=>setChecked(c=>({...c,[i]:e.target.checked}))}
                    style={{ marginTop:2, accentColor:"#0d9488", width:16, height:16, flexShrink:0 }} />
                  <span style={{ fontSize:13, color:"var(--color-text-primary)", lineHeight:1.5 }}>{item}</span>
                </label>
              ))}
            </div>
          )}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            <button onClick={()=>setStep(0)} style={ss.btn}>← Back</button>
            <button disabled={!allChecked} onClick={()=>setStep(2)}
              style={{ ...ss.btnP, flex:1, justifyContent:"center", opacity:allChecked?1:0.4 }}>
              {checklist.length===0?"Continue →":"All confirmed →"}
            </button>
          </div>
        </div>
      )}

      {/* step 2 — sign */}
      {step===2 && (
        <div>
          <p style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:16 }}>
            I, <strong>{name}</strong>, confirm I have read and understood the site induction for <strong>{site.name}</strong>.
          </p>
          <SigCanvas onCapture={handleSign} />
          <button onClick={()=>setStep(1)} style={{ ...ss.btn, marginTop:10 }}>← Back</button>
        </div>
      )}
    </div>
  );
}

// ─── Site manager — create sites with QR codes ───────────────────────────────
function SiteManager({ sites, onSave, onClose }) {
  const [list, setList] = useState(sites.map(s=>({...s, checklist:s.checklist||[]})));
  const [editing, setEditing] = useState(null);
  const [newItem, setNewItem] = useState("");

  const DEFAULT_CHECKLIST = [
    "I have been shown the site emergency evacuation procedure and muster point",
    "I am aware of the site rules including PPE requirements",
    "I know the location of first aid facilities and the first aider on site",
    "I understand the permit to work system in use on this site",
    "I am aware of any site-specific hazards relevant to my work area",
    "I have been briefed on the reporting procedure for accidents and near misses",
    "I understand I must not enter restricted areas without authorisation",
  ];

  const addSite = () => {
    const s = { id:genId(), name:"New site", address:"", checklist:[...DEFAULT_CHECKLIST], createdAt:new Date().toISOString() };
    setList(l=>[...l,s]);
    setEditing(s.id);
  };

  const updateSite = (id, field, val) => setList(l=>l.map(s=>s.id===id?{...s,[field]:val}:s));
  const removeSite = (id) => { setList(l=>l.filter(s=>s.id!==id)); if(editing===id) setEditing(null); };
  const addCheckItem = (id) => {
    if (!newItem.trim()) return;
    setList(l=>l.map(s=>s.id===id?{...s,checklist:[...s.checklist,newItem.trim()]}:s));
    setNewItem("");
  };
  const removeCheckItem = (siteId, i) => setList(l=>l.map(s=>s.id===siteId?{...s,checklist:s.checklist.filter((_,j)=>j!==i)}:s));

  const ed = list.find(s=>s.id===editing);

  return (
    <div style={{ minHeight:400, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:560 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontWeight:500, fontSize:16 }}>{ed ? "Edit site" : "Manage sites"}</span>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {!ed ? (
          <>
            {list.length===0 && <p style={{ fontSize:13, color:"var(--color-text-secondary)", textAlign:"center", padding:"1rem 0" }}>No sites yet.</p>}
            {list.map(s=>(
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:13 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{s.checklist?.length||0} checklist items</div>
                </div>
                <button onClick={()=>setEditing(s.id)} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Edit</button>
                <button onClick={()=>removeSite(s.id)} style={{ ...ss.btn, fontSize:12, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595" }}>×</button>
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" }}>
              <button onClick={addSite} style={ss.btn}>+ Add site</button>
              <button onClick={()=>onSave(list)} style={ss.btnP}>Save</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom:12 }}>
              <label style={ss.lbl}>Site name</label>
              <input value={ed.name} onChange={e=>updateSite(ed.id,"name",e.target.value)} style={ss.inp} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={ss.lbl}>Address / location</label>
              <input value={ed.address||""} onChange={e=>updateSite(ed.id,"address",e.target.value)} placeholder="e.g. Unit 11 Platinum Park DN9 3RU" style={ss.inp} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={ss.lbl}>Induction checklist items</label>
              <div style={{ maxHeight:200, overflowY:"auto", marginBottom:8 }}>
                {ed.checklist.map((item,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:6, alignItems:"flex-start" }}>
                    <span style={{ fontSize:12, color:"var(--color-text-primary)", flex:1, lineHeight:1.5, paddingTop:2 }}>{item}</span>
                    <button onClick={()=>removeCheckItem(ed.id,i)} style={{ ...ss.btn, padding:"2px 8px", fontSize:11, flexShrink:0 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCheckItem(ed.id)}
                  placeholder="Add checklist item…" style={{ ...ss.inp, flex:1 }} />
                <button onClick={()=>addCheckItem(ed.id)} style={ss.btnP}>Add</button>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setEditing(null)} style={ss.btn}>← Back</button>
              <button onClick={()=>setEditing(null)} style={ss.btnP}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── QR display modal ────────────────────────────────────────────────────────
function QRModal({ site, baseUrl, onClose }) {
  const url = `${baseUrl}?site=${site.id}&org=${getOrgId()}`;
  return (
    <div style={{ minHeight:480, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem 1rem" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:360, textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>
        <h3 style={{ fontWeight:500, fontSize:16, marginBottom:4 }}>Site induction QR</h3>
        <p style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:20 }}>{site.name}</p>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
          <QRCode value={url} size={200} />
        </div>
        <p style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:16, wordBreak:"break-all" }}>{url}</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
          <button onClick={()=>navigator.clipboard?.writeText(url)} style={ss.btn}>Copy link</button>
          <button onClick={()=>window.print()} style={ss.btnP}>Print QR</button>
        </div>
        <p style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:16 }}>
          Workers scan this with their phone camera to begin site induction
        </p>
      </div>
    </div>
  );
}

// ─── Site register — who is on site ─────────────────────────────────────────
function SiteRegister({ entries, sites }) {
  const today = new Date().toDateString();
  const todayEntries = entries.filter(e => new Date(e.timestamp).toDateString()===today);
  const siteMap = Object.fromEntries(sites.map(s=>[s.id,s.name]));

  const [search, setSearch] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterDate, setFilterDate] = useState("today");

  const filtered = entries.filter(e => {
    if (filterDate==="today" && new Date(e.timestamp).toDateString()!==today) return false;
    if (filterSite && e.siteId!==filterSite) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.company?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const initials = (n) => (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"On site today", value:todayEntries.length, color:"#27500A", bg:"#EAF3DE" },
          { label:"Total inductions", value:entries.length, color:"var(--color-text-primary)", bg:"var(--color-background-secondary,#f7f7f5)" },
          { label:"Sites active", value:new Set(entries.map(e=>e.siteId)).size, color:"#0C447C", bg:"#E6F1FB" },
        ].map(c=>(
          <div key={c.label} style={{ background:c.bg, borderRadius:8, padding:"12px 14px" }}>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:24, fontWeight:500, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or company…" style={{ ...ss.inp, width:"auto", flex:1, minWidth:140 }} />
        <select value={filterSite} onChange={e=>setFilterSite(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All sites</option>
          {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="today">Today only</option>
          <option value="all">All dates</option>
        </select>
      </div>

      {filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:10, color:"var(--color-text-secondary)", fontSize:13 }}>
          {filterDate==="today" ? "Nobody has signed in today yet." : "No records match your filters."}
        </div>
      ) : (
        <div style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"var(--color-background-secondary,#f7f7f5)" }}>
                {["Name","Company","Role","Site","Signed in","GPS"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map(e=>(
                <tr key={e.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:"#E1F5EE", color:"#085041", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, flexShrink:0 }}>
                        {initials(e.name)}
                      </div>
                      <span style={{ fontWeight:500 }}>{e.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:"9px 12px", color:"var(--color-text-secondary)" }}>{e.company||"—"}</td>
                  <td style={{ padding:"9px 12px", color:"var(--color-text-secondary)" }}>{e.role||"—"}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, background:"#E6F1FB", color:"#0C447C" }}>
                      {siteMap[e.siteId]||e.siteId}
                    </span>
                  </td>
                  <td style={{ padding:"9px 12px", color:"var(--color-text-secondary)", fontSize:12 }}>{fmt(e.timestamp)}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:"var(--color-text-secondary)" }}>
                    {e.gps ? `${e.gps.lat},${e.gps.lng}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function QRInduction() {
  const [tab, setTab] = useState("register"); // register | qr | preview
  const [sites, setSites] = useState(()=>load("induction_sites",[]));
  const [entries, setEntries] = useState(()=>load("induction_entries",[]));
  const [modal, setModal] = useState(null); // null | {type:'manage'} | {type:'qr', site} | {type:'form', site}
  const [selectedSite, setSelectedSite] = useState(null);

  useEffect(()=>{ save("induction_sites",sites); },[sites]);
  useEffect(()=>{ save("induction_entries",entries); },[entries]);

  // read URL params (simulating QR scan)
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get("site");
    if (siteId) {
      const site = sites.find(s=>s.id===siteId);
      if (site) { setModal({ type:"form", site }); setTab("preview"); }
    }
  },[]);

  const baseUrl = window.location.origin + window.location.pathname;

  const handleComplete = (record) => {
    setEntries(prev=>[...prev,record]);
    setTimeout(()=>setModal(null), 4000);
  };

  const exportCSV = () => {
    const rows = [["Name","Company","Role","Site","Date/Time","GPS Lat","GPS Lng","GPS Accuracy"]];
    entries.forEach(e=>rows.push([e.name,e.company||"",e.role||"",e.siteName||e.siteId,fmt(e.timestamp),e.gps?.lat||"",e.gps?.lng||"",e.gps?.accuracy||""]));
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`site_register_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {/* modals */}
      {modal?.type==="manage" && <SiteManager sites={sites} onSave={s=>{ setSites(s); setModal(null); }} onClose={()=>setModal(null)} />}
      {modal?.type==="qr" && <QRModal site={modal.site} baseUrl={baseUrl} onClose={()=>setModal(null)} />}
      {modal?.type==="form" && <InductionForm site={modal.site} checklist={modal.site.checklist||[]} onComplete={handleComplete} onBack={()=>setModal(null)} />}

      <PageHero
        badgeText="QR"
        title="QR site induction"
        lead="Workers scan QR on arrival — sign in, checklist, GPS timestamp."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setModal({ type: "manage" })} style={ss.btn}>
              Manage sites
            </button>
            {entries.length > 0 && (
              <button type="button" onClick={exportCSV} style={ss.btn}>
                Export CSV
              </button>
            )}
          </div>
        }
      />

      {/* tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", paddingBottom:0 }}>
        {[["register","Site register"],["qr","QR codes"],["preview","Test induction"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ ...ss.btn, borderRadius:"6px 6px 0 0", borderBottom:tab===t?"2px solid #0d9488":"2px solid transparent", background:tab===t?"var(--color-background-secondary,#f7f7f5)":"transparent", borderLeft:"none", borderRight:"none", borderTop:"none", fontWeight:tab===t?500:400, color:tab===t?"#0d9488":"var(--color-text-secondary)" }}>
            {l}
          </button>
        ))}
      </div>

      {/* site register */}
      {tab==="register" && <SiteRegister entries={entries} sites={sites} />}

      {/* QR codes */}
      {tab==="qr" && (
        <div>
          {sites.length===0 ? (
            <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
              <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No sites configured yet. Add a site to generate a QR code.</p>
              <button onClick={()=>setModal({type:"manage"})} style={ss.btnP}>Add first site</button>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
              {sites.map(s=>{
                const count = entries.filter(e=>e.siteId===s.id).length;
                return (
                  <div key={s.id} style={{ ...ss.card, textAlign:"center" }}>
                    <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
                      <QRCode value={`${baseUrl}?site=${s.id}&org=${getOrgId()}`} size={140} />
                    </div>
                    <div style={{ fontWeight:500, fontSize:14, marginBottom:4 }}>{s.name}</div>
                    {s.address && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8 }}>{s.address}</div>}
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:12 }}>{count} sign-ins total · {s.checklist?.length||0} checklist items</div>
                    <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                      <button onClick={()=>setModal({type:"qr",site:s})} style={{ ...ss.btnP, fontSize:12, padding:"5px 12px" }}>Full QR</button>
                      <button onClick={()=>{ setModal({type:"form",site:s}); setTab("preview"); }} style={{ ...ss.btn, fontSize:12, padding:"5px 12px" }}>Preview</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* test / preview induction */}
      {tab==="preview" && (
        <div>
          {sites.length===0 ? (
            <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, color:"var(--color-text-secondary)", fontSize:13 }}>
              Add a site first to preview the induction form.
            </div>
          ) : (
            <>
              <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                <label style={{ fontSize:13, color:"var(--color-text-secondary)", alignSelf:"center" }}>Preview site:</label>
                {sites.map(s=>(
                  <button key={s.id} onClick={()=>setSelectedSite(s)}
                    style={{ ...ss.btn, background:selectedSite?.id===s.id?"var(--color-background-secondary,#f7f7f5)":"transparent", fontWeight:selectedSite?.id===s.id?500:400 }}>
                    {s.name}
                  </button>
                ))}
              </div>
              {selectedSite ? (
                <div style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, overflow:"hidden" }}>
                  <div style={{ background:"var(--color-background-secondary,#f7f7f5)", padding:"8px 14px", fontSize:12, color:"var(--color-text-secondary)", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                    Preview — this is what workers see after scanning the QR code
                  </div>
                  <InductionForm
                    site={selectedSite}
                    checklist={selectedSite.checklist||[]}
                    onComplete={(r)=>{ setEntries(prev=>[...prev,r]); setSelectedSite(null); setTab("register"); }}
                    onBack={()=>setSelectedSite(null)}
                  />
                </div>
              ) : (
                <p style={{ fontSize:13, color:"var(--color-text-secondary)" }}>Select a site above to preview its induction form.</p>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ marginTop:24, padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        Each site gets a unique QR code. Workers scan on arrival, complete the checklist and sign. Records include name, company, role, GPS coordinates and timestamp. All data is isolated per organisation.
      </div>
    </div>
  );
}
