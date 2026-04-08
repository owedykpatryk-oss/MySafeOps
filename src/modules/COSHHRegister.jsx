import { useState, useEffect } from "react";
import { ms } from "../utils/moduleStyles";
import { safeHttpUrl } from "../utils/safeUrl";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `coshh_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };

const HAZARD_TYPES = ["Flammable","Oxidising","Explosive","Corrosive","Toxic","Very Toxic","Harmful/Irritant","Environmental","Carcinogen","Asphyxiant","Other"];
const EXPOSURE_ROUTES = ["Inhalation","Skin contact","Eye contact","Ingestion","Injection"];
const STORAGE_LOCATIONS = ["On-site store","Vehicle","Site cabin","Chemical store","Fridge","Other"];
const PPE_OPTIONS = ["Chemical resistant gloves","Safety glasses","Face shield","Respirator (FFP2)","Respirator (FFP3)","Half-face mask","Full-face mask","Chemical resistant apron","Chemical resistant boots","Nitrile gloves","Safety footwear","Hi-vis vest"];

const RISK_LEVELS = {
  low:    { label:"Low",    bg:"#EAF3DE", color:"#27500A" },
  medium: { label:"Medium", bg:"#FAEEDA", color:"#633806" },
  high:   { label:"High",   bg:"#FCEBEB", color:"#791F1F" },
};

const ss = {
  ...ms,
  ta: { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", minHeight:60 },
};

function PillSelector({ options, selected, onChange, max }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(o=>o!==opt));
    else if (!max || selected.length < max) onChange([...selected, opt]);
  };
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
      {options.map(o => {
        const sel = selected.includes(o);
        return (
          <button key={o} type="button" onClick={()=>toggle(o)} style={{
            padding:"3px 10px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
            background: sel ? "#0d9488" : "var(--color-background-secondary,#f7f7f5)",
            color: sel ? "#E1F5EE" : "var(--color-text-primary)",
            border: sel ? "0.5px solid #085041" : "0.5px solid var(--color-border-secondary,#ccc)",
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function SubstanceForm({ item, projects, onSave, onClose }) {
  const blank = {
    id:genId(), name:"", manufacturer:"", productCode:"", projectId:"",
    hazardTypes:[], exposureRoutes:[], riskLevel:"medium",
    quantity:"", unit:"litres", storageLocation:"On-site store", storageNotes:"",
    ppeRequired:[], firstAid:"", spillProcedure:"", disposalMethod:"",
    sdsUrl:"", sdsReviewDate:"", assessedBy:"", assessedDate:new Date().toISOString().slice(0,10),
    notes:"",
  };
  const [form, setForm] = useState(item ? {...item} : blank);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  return (
    <div style={{ minHeight:700, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem", overflowY:"auto" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:600 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontWeight:500, fontSize:16 }}>{item ? "Edit substance" : "Add substance"}</span>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        {/* identification */}
        <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Substance identification</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Substance / product name *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. WD-40 Multi-Use Lubricant" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Manufacturer</label>
            <input value={form.manufacturer} onChange={e=>set("manufacturer",e.target.value)} placeholder="e.g. WD-40 Company" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Product / UN code</label>
            <input value={form.productCode} onChange={e=>set("productCode",e.target.value)} placeholder="e.g. UN1950" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Project</label>
            <select value={form.projectId} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
              <option value="">— All projects —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Risk level</label>
            <select value={form.riskLevel} onChange={e=>set("riskLevel",e.target.value)} style={ss.inp}>
              {Object.entries(RISK_LEVELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* hazards */}
        <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Hazard classification</div>
        <div style={{ marginBottom:12 }}>
          <label style={ss.lbl}>Hazard types</label>
          <PillSelector options={HAZARD_TYPES} selected={form.hazardTypes} onChange={v=>set("hazardTypes",v)} />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Exposure routes</label>
          <PillSelector options={EXPOSURE_ROUTES} selected={form.exposureRoutes} onChange={v=>set("exposureRoutes",v)} />
        </div>

        {/* storage */}
        <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Storage</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
          <div>
            <label style={ss.lbl}>Quantity on site</label>
            <input value={form.quantity} onChange={e=>set("quantity",e.target.value)} placeholder="e.g. 5" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Unit</label>
            <select value={form.unit} onChange={e=>set("unit",e.target.value)} style={ss.inp}>
              {["litres","ml","kg","g","cans","bottles","drums","other"].map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Storage location</label>
            <select value={form.storageLocation} onChange={e=>set("storageLocation",e.target.value)} style={ss.inp}>
              {STORAGE_LOCATIONS.map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Storage conditions / notes</label>
            <input value={form.storageNotes} onChange={e=>set("storageNotes",e.target.value)} placeholder="e.g. Keep away from heat sources, store upright" style={ss.inp} />
          </div>
        </div>

        {/* PPE */}
        <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Required PPE</div>
        <div style={{ marginBottom:16 }}>
          <PillSelector options={PPE_OPTIONS} selected={form.ppeRequired} onChange={v=>set("ppeRequired",v)} />
        </div>

        {/* emergency */}
        <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Emergency procedures</div>
        <div style={{ marginBottom:12 }}>
          <label style={ss.lbl}>First aid measures</label>
          <textarea value={form.firstAid} onChange={e=>set("firstAid",e.target.value)} style={ss.ta} placeholder="e.g. Skin contact: wash with soap and water for 15 min. Eye contact: flush with water, seek medical advice." />
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={ss.lbl}>Spill / leak procedure</label>
          <textarea value={form.spillProcedure} onChange={e=>set("spillProcedure",e.target.value)} style={ss.ta} placeholder="e.g. Contain spill with absorbent material, ventilate area, dispose as hazardous waste." />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Disposal method</label>
          <input value={form.disposalMethod} onChange={e=>set("disposalMethod",e.target.value)} placeholder="e.g. Dispose as hazardous waste via licensed contractor" style={ss.inp} />
        </div>

        {/* SDS */}
        <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Safety Data Sheet (SDS)</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>SDS link / reference</label>
            <input value={form.sdsUrl} onChange={e=>set("sdsUrl",e.target.value)} placeholder="URL or document reference" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>SDS review date</label>
            <input type="date" value={form.sdsReviewDate} onChange={e=>set("sdsReviewDate",e.target.value)} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Assessment date</label>
            <input type="date" value={form.assessedDate} onChange={e=>set("assessedDate",e.target.value)} style={ss.inp} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Assessed by</label>
            <input value={form.assessedBy} onChange={e=>set("assessedBy",e.target.value)} placeholder="Name / role of person who conducted assessment" style={ss.inp} />
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Additional notes</label>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} style={ss.ta} placeholder="Any other relevant information…" />
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <button disabled={!form.name.trim()} onClick={()=>onSave(form)} style={{ ...ss.btnP, opacity:form.name.trim()?1:0.4 }}>
            {item ? "Save changes" : "Add substance"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubstanceCard({ item, onEdit, onDelete }) {
  const rl = RISK_LEVELS[item.riskLevel] || RISK_LEVELS.medium;
  return (
    <div style={{ ...ss.card, marginBottom:8 }}>
      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
        {/* hazard icon block */}
        <div style={{ width:48, height:48, borderRadius:8, background:rl.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={rl.color} strokeWidth={1.5}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <path d="M12 9v4M12 17h.01" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize:9, color:rl.color, fontWeight:500, marginTop:1 }}>{rl.label}</span>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
            <div>
              <div style={{ fontWeight:500, fontSize:14 }}>{item.name}</div>
              {item.manufacturer && <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{item.manufacturer}{item.productCode?` · ${item.productCode}`:""}</div>}
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button onClick={()=>onEdit(item)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Edit</button>
              <button onClick={()=>onDelete(item.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
            </div>
          </div>

          {/* hazard types */}
          {item.hazardTypes?.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
              {item.hazardTypes.map(h=>(
                <span key={h} style={{ padding:"1px 8px", borderRadius:20, fontSize:10, fontWeight:500, background:"#FAEEDA", color:"#633806" }}>{h}</span>
              ))}
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:4, fontSize:12 }}>
            {item.quantity && <span style={{ color:"var(--color-text-secondary)" }}>Qty: <strong>{item.quantity} {item.unit}</strong></span>}
            {item.storageLocation && <span style={{ color:"var(--color-text-secondary)" }}>Store: <strong>{item.storageLocation}</strong></span>}
            {item.assessedDate && <span style={{ color:"var(--color-text-secondary)" }}>Assessed: {fmtDate(item.assessedDate)}</span>}
            {item.sdsUrl && (() => {
              const sdsSafe = safeHttpUrl(item.sdsUrl);
              return sdsSafe ? (
                <a href={sdsSafe} target="_blank" rel="noopener noreferrer" style={{ color:"#185FA5" }}>View SDS →</a>
              ) : (
                <span style={{ color:"var(--color-text-secondary)" }}>SDS URL invalid</span>
              );
            })()}
          </div>

          {/* PPE */}
          {item.ppeRequired?.length > 0 && (
            <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:"var(--color-text-secondary)", fontWeight:500 }}>PPE:</span>
              {item.ppeRequired.map(p=>(
                <span key={p} style={{ padding:"1px 8px", borderRadius:20, fontSize:10, background:"#E6F1FB", color:"#0C447C" }}>{p}</span>
              ))}
            </div>
          )}

          {/* first aid snippet */}
          {item.firstAid && (
            <div style={{ marginTop:8, padding:"6px 10px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6, fontSize:12, color:"var(--color-text-secondary)", borderLeft:"2px solid #E24B4A" }}>
              <strong style={{ color:"#791F1F" }}>First aid: </strong>{item.firstAid.slice(0,120)}{item.firstAid.length>120?"…":""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function COSHHRegister() {
  const [items, setItems] = useState(()=>load("coshh_items",[]));
  const [projects] = useState(()=>load("mysafeops_projects",[]));
  const [modal, setModal] = useState(null);
  const [filterRisk, setFilterRisk] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterHazard, setFilterHazard] = useState("");
  const [search, setSearch] = useState("");

  useEffect(()=>{ save("coshh_items",items); },[items]);

  const saveItem = (item) => {
    setItems(prev => prev.find(i=>i.id===item.id) ? prev.map(i=>i.id===item.id?item:i) : [item,...prev]);
    setModal(null);
  };
  const deleteItem = (id) => { if(confirm("Remove this substance?")) setItems(prev=>prev.filter(i=>i.id!==id)); };

  const filtered = items.filter(i=>{
    if (filterRisk && i.riskLevel!==filterRisk) return false;
    if (filterProject && i.projectId!==filterProject) return false;
    if (filterHazard && !i.hazardTypes?.includes(filterHazard)) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.manufacturer?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    high: items.filter(i=>i.riskLevel==="high").length,
    medium: items.filter(i=>i.riskLevel==="medium").length,
    low: items.filter(i=>i.riskLevel==="low").length,
  };

  const exportCSV = () => {
    const rows=[["Name","Manufacturer","Product code","Risk","Hazard types","Quantity","Unit","Storage","PPE required","SDS link","Assessed by","Assessed date"]];
    items.forEach(i=>rows.push([i.name,i.manufacturer||"",i.productCode||"",i.riskLevel,i.hazardTypes?.join("; ")||"",i.quantity||"",i.unit||"",i.storageLocation||"",i.ppeRequired?.join("; ")||"",i.sdsUrl||"",i.assessedBy||"",fmtDate(i.assessedDate)]));
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`coshh_register_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {modal?.type==="form" && <SubstanceForm item={modal.data} projects={projects} onSave={saveItem} onClose={()=>setModal(null)} />}

      <PageHero
        badgeText="COS"
        title="COSHH register"
        lead="Control of Substances Hazardous to Health — COSHH Regs 2002. Data stays on this device."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {items.length > 0 && (
              <button type="button" onClick={exportCSV} style={ss.btn}>
                Export CSV
              </button>
            )}
            <button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnP}>
              + Add substance
            </button>
          </div>
        }
      />

      {items.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:10, marginBottom:20 }}>
          {[["High risk",stats.high,"#FCEBEB","#791F1F"],["Medium risk",stats.medium,"#FAEEDA","#633806"],["Low risk",stats.low,"#EAF3DE","#27500A"]].map(([l,v,bg,c])=>(
            <div key={l} style={{ background:bg, borderRadius:8, padding:"10px 14px", cursor:"pointer" }} onClick={()=>setFilterRisk(prev=>prev===l.split(" ")[0].toLowerCase()?"":l.split(" ")[0].toLowerCase())}>
              <div style={{ fontSize:11, color:c, fontWeight:500, marginBottom:2 }}>{l}</div>
              <div style={{ fontSize:22, fontWeight:500, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search substance…" style={{ ...ss.inp, width:"auto", flex:1, minWidth:140 }} />
        <select value={filterRisk} onChange={e=>setFilterRisk(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All risk levels</option>
          {Object.entries(RISK_LEVELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterHazard} onChange={e=>setFilterHazard(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All hazard types</option>
          {HAZARD_TYPES.map(h=><option key={h}>{h}</option>)}
        </select>
        {projects.length>0 && (
          <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
            <option value="">All projects</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {(filterRisk||filterProject||filterHazard||search) && <button onClick={()=>{setFilterRisk("");setFilterProject("");setFilterHazard("");setSearch("");}} style={{ ...ss.btn, fontSize:12 }}>Clear</button>}
      </div>

      {items.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No substances recorded yet.</p>
          <button onClick={()=>setModal({type:"form"})} style={ss.btnP}>+ Add first substance</button>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, color:"var(--color-text-secondary)", fontSize:13 }}>No items match your filters.</div>
      ) : (
        filtered.map(i=><SubstanceCard key={i.id} item={i} onEdit={i=>setModal({type:"form",data:i})} onDelete={deleteItem} />)
      )}

      <div style={{ marginTop:20, padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        COSHH Regulations 2002. Each substance includes hazard classification, PPE requirements, first aid and spill procedures, SDS reference and assessment record. Export full register to CSV.
      </div>
    </div>
  );
}
