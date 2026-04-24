import { useState, useEffect, useRef, useMemo } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const genId = () => `insp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
const daysUntil = (iso) => { if (!iso) return null; return Math.ceil((new Date(iso)-new Date())/(1000*60*60*24)); };

const INSPECTION_TYPES = {
  loler: { label:"LOLER thorough examination", color:"#791F1F", bg:"#FCEBEB", freq:"6 months (passenger) / 12 months (other)", regs:"LOLER 1998 Reg 9" },
  pat: { label:"PAT (portable appliance test)", color:"#0C447C", bg:"#E6F1FB", freq:"Varies by risk — typically 1–2 years", regs:"IET CoP for In-Service Inspection" },
  puwer: { label:"PUWER inspection", color:"#633806", bg:"#FAEEDA", freq:"As per manufacturer / risk assessment", regs:"PUWER 1998 Reg 6" },
  pssr: { label:"PSSR written scheme (pressure)", color:"#791F1F", bg:"#FAECE7", freq:"14 months (steam) / 48 months (other)", regs:"PSSR 2000 Reg 8" },
  eicr: { label:"EICR (electrical installation)", color:"#3C3489", bg:"#EEEDFE", freq:"5 years commercial / 10 years domestic", regs:"BS 7671 / EICR" },
  ladder: { label:"Ladder inspection", color:"#854F0B", bg:"#FAEEDA", freq:"Before each use (formal: 3 monthly)", regs:"Work at Height Regs 2005" },
  mewp: { label:"MEWP inspection (LOLER)", color:"#085041", bg:"#E1F5EE", freq:"6 monthly thorough examination", regs:"LOLER 1998 / IPAF" },
  scaffold: { label:"Scaffold inspection", color:"#444441", bg:"#F1EFE8", freq:"Every 7 days + after adverse weather", regs:"Work at Height Regs 2005" },
  fire_ext: { label:"Fire extinguisher service", color:"#A32D2D", bg:"#FCEBEB", freq:"Annual", regs:"BS 5306-3:2017" },
  eyewash: { label:"Eye wash station check", color:"#0C447C", bg:"#E6F1FB", freq:"Weekly", regs:"BS EN 15154" },
  harness: { label:"Harness & fall arrest inspection", color:"#712B13", bg:"#FAECE7", freq:"6 monthly formal / pre-use visual", regs:"Work at Height Regs 2005 / EN 361" },
  other: { label:"Other equipment inspection", color:"#5F5E5A", bg:"#F1EFE8", freq:"As specified", regs:"" },
};

const ss = { ...ms, ta: { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", minHeight:50 } };

function InspectionForm({ item, onSave, onClose, projects }) {
  const blank = {
    id:genId(), type:"loler", name:"", serialNo:"", location:"",
    projectId:"", manufacturer:"", model:"", swl:"",
    lastInspectionDate:today(), nextInspectionDate:"",
    inspectedBy:"", certNumber:"", result:"pass",
    notes:"", photo:null, createdAt:new Date().toISOString(),
  };
  const [form, setForm] = useState(item?{...item}:blank);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const photoRef = useRef();

  const def = INSPECTION_TYPES[form.type]||INSPECTION_TYPES.other;

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => set("photo",ev.target.result);
    r.readAsDataURL(file);
  };

  return (
    <div style={{ minHeight:600, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:580 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontWeight:500, fontSize:15 }}>{item?"Edit inspection record":"New inspection record"}</span>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Inspection type</label>
            <select value={form.type} onChange={e=>set("type",e.target.value)} style={ss.inp}>
              {Object.entries(INSPECTION_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>Frequency: {def.freq} · {def.regs}</div>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Equipment / item name *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. 2-tonne chain block, 110V drill, MEWP Genie GS-1930" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Serial / asset number</label>
            <input value={form.serialNo||""} onChange={e=>set("serialNo",e.target.value)} placeholder="Asset tag or serial no." style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Manufacturer / model</label>
            <input value={form.manufacturer||""} onChange={e=>set("manufacturer",e.target.value)} placeholder="e.g. Yale / 2T chainblock" style={ss.inp} />
          </div>
          {(form.type==="loler"||form.type==="mewp"||form.type==="lifting") && (
            <div>
              <label style={ss.lbl}>Safe working load (SWL)</label>
              <input value={form.swl||""} onChange={e=>set("swl",e.target.value)} placeholder="e.g. 2000 kg" style={ss.inp} />
            </div>
          )}
          <div>
            <label style={ss.lbl}>Location / project</label>
            <input value={form.location||""} onChange={e=>set("location",e.target.value)} placeholder="Where is item kept?" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Project</label>
            <select value={form.projectId||""} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
              <option value="">— General / all projects —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Last inspection date</label>
            <input type="date" value={form.lastInspectionDate} onChange={e=>set("lastInspectionDate",e.target.value)} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Next inspection due</label>
            <input type="date" value={form.nextInspectionDate||""} onChange={e=>set("nextInspectionDate",e.target.value)} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Inspected / tested by</label>
            <input value={form.inspectedBy||""} onChange={e=>set("inspectedBy",e.target.value)} placeholder="Name or company" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Certificate / report number</label>
            <input value={form.certNumber||""} onChange={e=>set("certNumber",e.target.value)} placeholder="Reference number" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Result</label>
            <select value={form.result||"pass"} onChange={e=>set("result",e.target.value)} style={ss.inp}>
              <option value="pass">Pass — in service</option>
              <option value="pass_minor">Pass with minor defects noted</option>
              <option value="fail">Fail — removed from service</option>
              <option value="quarantine">Quarantined pending repair</option>
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Notes / defects / observations</label>
            <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} style={ss.ta} placeholder="Inspection notes, defects, repairs required…" />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Photo of inspection label / certificate</label>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {form.photo && <img src={form.photo} alt="inspection" style={{ width:80, height:80, objectFit:"cover", borderRadius:6, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }} />}
              <button onClick={()=>photoRef.current.click()} style={ss.btn}>
                {form.photo?"Change photo":"Add photo"}
              </button>
              {form.photo && <button onClick={()=>set("photo",null)} style={{ ...ss.btn, color:"#A32D2D", borderColor:"#F09595" }}>Remove</button>}
              <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handlePhoto} />
            </div>
          </div>
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end", marginTop:16 }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <button disabled={!form.name.trim()} onClick={()=>onSave(form)} style={{ ...ss.btnP, opacity:form.name.trim()?1:0.4 }}>
            {item?"Save changes":"Add record"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InspectionTracker() {
  const [items, setItems] = useState(()=>load("inspection_records",[]));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [filterDue, setFilterDue] = useState("all");
  const [search, setSearch] = useState("");
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1InspH, d1OutboxPending: d1InspO } = useD1OrgArraySync({
    storageKey: "inspection_records",
    namespace: "inspection_records",
    value: items,
    setValue: setItems,
    load,
    save,
  });
  const { d1Hydrating: d1ProjH, d1OutboxPending: d1ProjO } = useD1OrgArraySync({
    storageKey: "mysafeops_projects",
    namespace: "mysafeops_projects",
    value: projects,
    setValue: setProjects,
    load,
    save,
  });
  const d1Hydrating = d1InspH || d1ProjH;
  const d1OutboxPending = d1InspO || d1ProjO;

  useEffect(() => {
    listPg.reset();
  }, [filterType, filterResult, filterDue, search]);

  const saveItem = (item) => {
    setItems(prev=>prev.find(x=>x.id===item.id)?prev.map(x=>x.id===item.id?item:x):[item,...prev]);
    setModal(null);
  };

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (filterType && i.type !== filterType) return false;
        if (filterResult && i.result !== filterResult) return false;
        if (search && !i.name?.toLowerCase().includes(search.toLowerCase()) && !i.serialNo?.toLowerCase().includes(search.toLowerCase()) && !i.location?.toLowerCase().includes(search.toLowerCase())) return false;
        const days = daysUntil(i.nextInspectionDate);
        if (filterDue === "overdue" && !(days !== null && days < 0)) return false;
        if (filterDue === "due30" && !(days !== null && days >= 0 && days <= 30)) return false;
        if (filterDue === "ok" && !(days === null || days > 30)) return false;
        return true;
      }),
    [items, filterType, filterResult, filterDue, search]
  );

  const stats = {
    overdue: items.filter(i=>daysUntil(i.nextInspectionDate)<0).length,
    due30: items.filter(i=>{const d=daysUntil(i.nextInspectionDate);return d!==null&&d>=0&&d<=30;}).length,
    fail: items.filter(i=>i.result==="fail"||i.result==="quarantine").length,
    total: items.length,
  };

  const getStatusPill = (item) => {
    if (item.result==="fail") return { bg:"#FCEBEB", color:"#791F1F", label:"Failed" };
    if (item.result==="quarantine") return { bg:"#FAEEDA", color:"#633806", label:"Quarantined" };
    const days = daysUntil(item.nextInspectionDate);
    if (days===null) return { bg:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)", label:"No due date" };
    if (days<0) return { bg:"#FCEBEB", color:"#791F1F", label:`Overdue ${Math.abs(days)}d` };
    if (days<=7) return { bg:"#FCEBEB", color:"#791F1F", label:`Due in ${days}d` };
    if (days<=30) return { bg:"#FAEEDA", color:"#633806", label:`Due in ${days}d` };
    return { bg:"#EAF3DE", color:"#27500A", label:`Due ${fmtDate(item.nextInspectionDate)}` };
  };

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="inspection register" />
      {modal?.type==="form" && (
        <InspectionForm item={modal.data} projects={projects} onSave={saveItem} onClose={() => setModal(null)} />
      )}

      <PageHero
        badgeText="IN"
        title="Inspection register"
        lead="LOLER, PAT, PUWER, PSSR, EICR, scaffold, ladder, harness and more — due dates and outcomes in one place."
        right={
          <button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnP}>
            + Add inspection record
          </button>
        }
      />

      {items.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:8, marginBottom:20 }}>
          {[
            { label:"Overdue", value:stats.overdue, bg:"#FCEBEB", color:"#791F1F", filter:()=>setFilterDue("overdue") },
            { label:"Due in 30 days", value:stats.due30, bg:"#FAEEDA", color:"#633806", filter:()=>setFilterDue("due30") },
            { label:"Failed / quarantined", value:stats.fail, bg:"#FCEBEB", color:"#791F1F", filter:()=>setFilterResult("fail") },
            { label:"Total records", value:stats.total, bg:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-primary)", filter:()=>setFilterDue("all") },
          ].map(c=>(
            <div key={c.label} onClick={c.filter} style={{ background:c.bg, borderRadius:8, padding:"10px 12px", cursor:"pointer" }}>
              <div style={{ fontSize:11, color:c.color, fontWeight:500, marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:500, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search equipment…" style={{ ...ss.inp, flex:1, width:"auto", minWidth:140 }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All types</option>
          {Object.entries(INSPECTION_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterDue} onChange={e=>setFilterDue(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="all">All statuses</option>
          <option value="overdue">Overdue</option>
          <option value="due30">Due in 30 days</option>
          <option value="ok">Up to date</option>
        </select>
        {(search||filterType||filterResult||(filterDue!=="all"))&&<button onClick={()=>{setSearch("");setFilterType("");setFilterResult("");setFilterDue("all");listPg.reset();}} style={{ ...ss.btn, fontSize:12 }}>Clear</button>}
      </div>

      {items.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No inspection records yet.</p>
          <button onClick={()=>setModal({type:"form"})} style={ss.btnP}>+ Add first record</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {listPg.hasMore(filtered) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, filtered.length)} of {filtered.length} records
            </div>
          ) : null}
          {listPg.visible(filtered).map((item) => {
            const def = INSPECTION_TYPES[item.type]||INSPECTION_TYPES.other;
            const pill = getStatusPill(item);
            return (
              <div key={item.id} style={{ ...ss.card, display:"flex", gap:12, alignItems:"center", borderLeft:`3px solid ${def.color}`, contentVisibility:"auto", containIntrinsicSize:"0 72px" }}>
                {item.photo && <img src={item.photo} alt="inspection" style={{ width:48, height:48, objectFit:"cover", borderRadius:6, flexShrink:0, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:500, fontSize:14 }}>{item.name}</span>
                    <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:500, background:def.bg, color:def.color }}>{def.label}</span>
                    <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:500, background:pill.bg, color:pill.color }}>{pill.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
                    {item.serialNo && <span>S/N: {item.serialNo}</span>}
                    {item.location && <span>{item.location}</span>}
                    {item.inspectedBy && <span>By: {item.inspectedBy}</span>}
                    {item.certNumber && <span>Cert: {item.certNumber}</span>}
                    {item.swl && <span>SWL: {item.swl}</span>}
                    <span>Last: {fmtDate(item.lastInspectionDate)}</span>
                  </div>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0 }}>
                  <button onClick={()=>setModal({type:"form",data:item})} style={{ ...ss.btn, fontSize:12, padding:"4px 10px" }}>Edit</button>
                  <button onClick={()=>{ if(confirm("Delete?")) setItems(prev=>prev.filter(x=>x.id!==item.id)); }} style={{ ...ss.btn, fontSize:12, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                </div>
              </div>
            );
          })}
          {listPg.hasMore(filtered) ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(filtered)} remaining)
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
