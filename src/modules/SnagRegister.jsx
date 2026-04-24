import { useState, useEffect, useRef, useMemo } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `snag_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };
const today = () => new Date().toISOString().slice(0,10);

const PRIORITIES = { low:{ label:"Low", bg:"#EAF3DE", color:"#27500A" }, medium:{ label:"Medium", bg:"#FAEEDA", color:"#633806" }, high:{ label:"High", bg:"#FCEBEB", color:"#791F1F" } };
const STATUSES = { open:{ label:"Open", bg:"#FCEBEB", color:"#791F1F" }, in_progress:{ label:"In progress", bg:"#FAEEDA", color:"#633806" }, closed:{ label:"Closed", bg:"#EAF3DE", color:"#27500A" }, wont_fix:{ label:"Won't fix", bg:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)" } };
const CATEGORIES = ["Electrical","Mechanical","Pipework","Civil/Structural","Finishing","Safety","Commissioning","Other"];

const ss = ms;
const SNAG_LIST_PAGE = 60;

function Badge({ type, value }) {
  const map = type==="status" ? STATUSES : PRIORITIES;
  const c = map[value] || map.open || map.low;
  return <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:c.bg, color:c.color, whiteSpace:"nowrap" }}>{c.label}</span>;
}

function PhotoCapture({ photos, onChange }) {
  const inputRef = useRef();

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onChange(prev => [...prev, { id:genId(), dataUrl:ev.target.result, name:file.name, ts:new Date().toISOString() }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:8 }}>
        {photos.map(p => (
          <div key={p.id} style={{ position:"relative", width:80, height:80 }}>
            <img src={p.dataUrl} alt={p.name} loading="lazy" decoding="async" style={{ width:80, height:80, objectFit:"cover", borderRadius:6, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }} />
            <button onClick={() => onChange(prev => prev.filter(x => x.id !== p.id))}
              style={{ position:"absolute", top:-6, right:-6, width:18, height:18, borderRadius:"50%", background:"#E24B4A", color:"#fff", border:"none", cursor:"pointer", fontSize:12, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
        ))}
        <button onClick={() => inputRef.current.click()} style={{
          width:80, height:80, borderRadius:6, border:"0.5px dashed var(--color-border-secondary,#ccc)",
          background:"var(--color-background-secondary,#f7f7f5)", cursor:"pointer", display:"flex",
          flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, color:"var(--color-text-secondary)", fontSize:11
        }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          Add photo
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" style={{ display:"none" }} onChange={handleFiles} />
    </div>
  );
}

function SnagForm({ snag, workers, projects, onSave, onClose }) {
  const blank = { id:genId(), title:"", description:"", category:"Electrical", priority:"medium", status:"open", projectId:"", location:"", assignedTo:"", dueDate:"", photos:[], createdAt:new Date().toISOString(), ref:"" };
  const [form, setForm] = useState(snag ? {...snag} : blank);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const autoRef = () => {
    if (!form.ref) { const r=`SN-${String(load("snag_counter",1)).padStart(3,"0")}`; save("snag_counter",(load("snag_counter",1)||1)+1); set("ref",r); }
  };
  useEffect(autoRef,[]);

  return (
    <div style={{ minHeight:600, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"1.5rem 1rem" }}>
      <div style={{ ...ss.card, width:"100%", maxWidth:560 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontWeight:500, fontSize:16 }}>{snag ? `Edit snag ${snag.ref||""}` : "New snag item"}</span>
          <button onClick={onClose} style={{ ...ss.btn, padding:"4px 8px" }}>×</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          <div>
            <label style={ss.lbl}>Reference</label>
            <input value={form.ref} onChange={e=>set("ref",e.target.value)} placeholder="SN-001" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Project</label>
            <select value={form.projectId} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
              <option value="">— Select project —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={ss.lbl}>Title / description of defect *</label>
          <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Cable tray not secured at junction box" style={ss.inp} />
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={ss.lbl}>Detail notes</label>
          <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="Additional details, measurements, observations…" style={{ ...ss.inp, resize:"vertical" }} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
          <div>
            <label style={ss.lbl}>Category</label>
            <select value={form.category} onChange={e=>set("category",e.target.value)} style={ss.inp}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Priority</label>
            <select value={form.priority} onChange={e=>set("priority",e.target.value)} style={ss.inp}>
              {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={ss.inp}>
              {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          <div>
            <label style={ss.lbl}>Location on site</label>
            <input value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Level 2, Zone B, near pump room" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Assigned to</label>
            <select value={form.assignedTo} onChange={e=>set("assignedTo",e.target.value)} style={ss.inp}>
              <option value="">— Unassigned —</option>
              {workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Due date</label>
          <input type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)} style={{ ...ss.inp, width:"auto" }} />
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Photos</label>
          <PhotoCapture photos={form.photos||[]} onChange={(fn) => setForm(f=>({...f, photos: typeof fn==="function" ? fn(f.photos||[]) : fn}))} />
        </div>

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
          <button onClick={onClose} style={ss.btn}>Cancel</button>
          <button disabled={!form.title.trim()} onClick={()=>onSave(form)} style={{ ...ss.btnP, opacity:form.title.trim()?1:0.4 }}>
            {snag ? "Save changes" : "Add snag"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SnagCard({ snag, workers, onEdit, onDelete, onStatusChange, bulkMode, selected, onToggleSelect, canDelete }) {
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const overdue = snag.dueDate && snag.status==="open" && new Date(snag.dueDate) < new Date();

  return (
    <div style={{ ...ss.card, marginBottom: 8, contentVisibility: "auto", containIntrinsicSize: "0 100px" }}>
      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
        {bulkMode && (
          <label style={{ display:"flex", alignItems:"flex-start", paddingTop:4, cursor:"pointer" }}>
            <input type="checkbox" checked={selected} onChange={() => onToggleSelect(snag.id)} />
          </label>
        )}
        {/* photos */}
        {snag.photos?.length > 0 && (
          <img
            src={snag.photos[0].dataUrl}
            alt="snag"
            loading="lazy"
            decoding="async"
            style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}
          />
        )}
        {!snag.photos?.length && (
          <div style={{ width:72, height:72, borderRadius:8, background:"var(--color-background-secondary,#f7f7f5)", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--color-border-secondary,#ccc)" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </div>
        )}

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:6, flexWrap:"wrap" }}>
            {snag.ref && <span style={{ fontSize:11, color:"var(--color-text-secondary)", fontWeight:500 }}>{snag.ref}</span>}
            <Badge type="status" value={snag.status} />
            <Badge type="priority" value={snag.priority} />
            {snag.category && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#E6F1FB", color:"#0C447C" }}>{snag.category}</span>}
            {overdue && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#FCEBEB", color:"#791F1F" }}>Overdue</span>}
          </div>

          <div style={{ fontWeight:500, fontSize:14, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{snag.title}</div>

          {snag.description && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:6, lineHeight:1.5 }}>{snag.description.slice(0,120)}{snag.description.length>120?"…":""}</div>}

          <div style={{ display:"flex", gap:16, fontSize:11, color:"var(--color-text-secondary)", flexWrap:"wrap" }}>
            {snag.location && <span>📍 {snag.location}</span>}
            {snag.assignedTo && <span>👤 {workerMap[snag.assignedTo]||snag.assignedTo}</span>}
            {snag.dueDate && <span style={{ color:overdue?"#A32D2D":"inherit" }}>Due: {fmtDate(snag.dueDate)}</span>}
            {snag.photos?.length > 1 && <span>+{snag.photos.length-1} photos</span>}
            <span>Added: {fmtDate(snag.createdAt)}</span>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
          <select value={snag.status} onChange={e=>onStatusChange(snag.id,e.target.value)}
            style={{ ...ss.inp, width:"auto", padding:"4px 8px", fontSize:11 }}>
            {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={()=>onEdit(snag)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Edit</button>
          {canDelete !== false && (
            <button onClick={()=>onDelete(snag.id)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SnagRegister() {
  const { caps } = useApp();
  const [snags, setSnags] = useState(()=>load("snags",[]));
  const [workers, setWorkers] = useState(()=>load("mysafeops_workers",[]));
  const [projects, setProjects] = useState(()=>load("mysafeops_projects",[]));
  const [modal, setModal] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const listPg = useRegisterListPaging(SNAG_LIST_PAGE);

  const { d1Syncing: d1SnagsSyncing } = useD1OrgArraySync({
    storageKey: "snags",
    namespace: "snags",
    value: snags,
    setValue: setSnags,
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
  const d1Syncing = d1SnagsSyncing || d1WpSyncing;

  useEffect(() => {
    listPg.reset();
  }, [filterStatus, filterPriority, filterProject, filterCategory, filterAssigned, search, sort]);

  const saveSnag = (snag) => {
    setSnags(prev => prev.find(s=>s.id===snag.id) ? prev.map(s=>s.id===snag.id?snag:s) : [snag,...prev]);
    setModal(null);
  };
  const deleteSnag = (id) => {
    if (!caps.deleteRecords) return;
    if (confirm("Delete this snag item?")) { setSnags(prev=>prev.filter(s=>s.id!==id)); setModal(null); }
  };
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const statusChange = (id,status) => setSnags(prev=>prev.map(s=>s.id===id?{...s,status,closedAt:status==="closed"?new Date().toISOString():s.closedAt}:s));

  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));

  const exportSelectedCsv = () => {
    const pick = snags.filter((s) => selected.has(s.id));
    if (!pick.length) return;
    const rows=[["Ref","Title","Category","Priority","Status","Project","Location","Assigned to","Due date","Created","Notes"]];
    pick.forEach(s=>rows.push([s.ref||"",s.title,s.category||"",s.priority,s.status,projectMap[s.projectId]||"",s.location||"",workerMap[s.assignedTo]||"",s.dueDate||"",fmtDate(s.createdAt),s.description||""]));
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`snags_selected_${today()}.csv`; a.click();
  };
  const bulkMarkClosed = () => {
    if (!caps.bulkSnag || !selected.size) return;
    if (!confirm(`Mark ${selected.size} snag(s) as closed?`)) return;
    const ids = selected;
    setSnags((prev) => prev.map((s) => (ids.has(s.id) ? { ...s, status: "closed", closedAt: new Date().toISOString() } : s)));
    setSelected(new Set());
  };

  const filtered = useMemo(() => {
    const list = snags.filter((s) => {
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterPriority && s.priority !== filterPriority) return false;
      if (filterProject && s.projectId !== filterProject) return false;
      if (filterCategory && s.category !== filterCategory) return false;
      if (filterAssigned && s.assignedTo !== filterAssigned) return false;
      if (
        search &&
        !s.title.toLowerCase().includes(search.toLowerCase()) &&
        !s.description?.toLowerCase().includes(search.toLowerCase()) &&
        !s.location?.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "priority") {
        const o = { high: 0, medium: 1, low: 2 };
        return (o[a.priority] || 1) - (o[b.priority] || 1);
      }
      if (sort === "due") return (a.dueDate || "9999") > (b.dueDate || "9999") ? 1 : -1;
      return 0;
    });
  }, [snags, filterStatus, filterPriority, filterProject, filterCategory, filterAssigned, search, sort]);

  const stats = {
    open: snags.filter(s=>s.status==="open").length,
    in_progress: snags.filter(s=>s.status==="in_progress").length,
    closed: snags.filter(s=>s.status==="closed").length,
    high: snags.filter(s=>s.priority==="high"&&s.status!=="closed").length,
    overdue: snags.filter(s=>s.dueDate&&s.status==="open"&&new Date(s.dueDate)<new Date()).length,
  };

  const exportCSV = () => {
    const rows=[["Ref","Title","Category","Priority","Status","Project","Location","Assigned to","Due date","Created","Notes"]];
    snags.forEach(s=>rows.push([s.ref||"",s.title,s.category||"",s.priority,s.status,projectMap[s.projectId]||"",s.location||"",workerMap[s.assignedTo]||"",s.dueDate||"",fmtDate(s.createdAt),s.description||""]));
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`snag_register_${today()}.csv`; a.click();
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterPriority("");
    setFilterProject("");
    setFilterCategory("");
    setFilterAssigned("");
    setSearch("");
    listPg.reset();
  };
  const hasFilters = filterStatus||filterPriority||filterProject||filterCategory||filterAssigned||search;

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {d1Syncing ? (
        <div
          className="app-panel-surface"
          style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}
        >
          Syncing snags and lists with cloud…
        </div>
      ) : null}
      {modal?.type==="form" && <SnagForm snag={modal.data} workers={workers} projects={projects} onSave={saveSnag} onClose={()=>setModal(null)} />}

      <PageHero
        badgeText="SN"
        title="Snagging register"
        lead="Track defects, assign to team, monitor resolution. Data stays on this device."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {caps.bulkSnag && snags.length > 0 && (
              <button type="button" onClick={() => { setBulkMode((b) => !b); setSelected(new Set()); }} style={ss.btn}>
                {bulkMode ? "Done selecting" : "Bulk select"}
              </button>
            )}
            {bulkMode && selected.size > 0 && (
              <>
                <button type="button" onClick={exportSelectedCsv} style={ss.btn}>
                  Export selected
                </button>
                <button type="button" onClick={bulkMarkClosed} style={ss.btnP}>
                  Mark closed
                </button>
              </>
            )}
            {snags.length > 0 && (
              <button type="button" onClick={exportCSV} style={ss.btn}>
                Export CSV
              </button>
            )}
            <button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnP}>
              + Add snag
            </button>
          </div>
        }
      />

      {/* summary */}
      {snags.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:8, marginBottom:20 }}>
          {[
            { label:"Open", value:stats.open, bg:"#FCEBEB", color:"#791F1F", click:()=>setFilterStatus("open") },
            { label:"In progress", value:stats.in_progress, bg:"#FAEEDA", color:"#633806", click:()=>setFilterStatus("in_progress") },
            { label:"Closed", value:stats.closed, bg:"#EAF3DE", color:"#27500A", click:()=>setFilterStatus("closed") },
            { label:"High priority", value:stats.high, bg:"#FAECE7", color:"#712B13", click:()=>setFilterPriority("high") },
            { label:"Overdue", value:stats.overdue, bg:"#FAEEDA", color:"#633806", click:()=>{} },
          ].map(c=>(
            <div key={c.label} onClick={c.click} style={{ background:c.bg, borderRadius:8, padding:"10px 12px", cursor:"pointer" }}>
              <div style={{ fontSize:11, color:c.color, marginBottom:2, fontWeight:500 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:500, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ ...ss.inp, width:"auto", minWidth:140, flex:1 }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All statuses</option>
          {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All priorities</option>
          {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
        {projects.length>0 && (
          <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
            <option value="">All projects</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {workers.length>0 && (
          <select value={filterAssigned} onChange={e=>setFilterAssigned(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
            <option value="">All assignees</option>
            {workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{ ...ss.inp, width:"auto" }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">By priority</option>
          <option value="due">By due date</option>
        </select>
        {hasFilters && <button onClick={clearFilters} style={{ ...ss.btn, fontSize:12 }}>Clear filters</button>}
      </div>

      {/* count */}
      {snags.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          Showing {filtered.length} of {snags.length} items
          {listPg.hasMore(filtered) ? ` · displaying ${Math.min(listPg.cap, filtered.length)}` : ""}
        </div>
      )}

      {/* empty */}
      {snags.length===0 && (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No snag items recorded yet.</p>
          <button onClick={()=>setModal({type:"form"})} style={ss.btnP}>+ Add first snag</button>
        </div>
      )}
      {snags.length>0 && filtered.length===0 && (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, color:"var(--color-text-secondary)", fontSize:13 }}>
          No items match your filters.
        </div>
      )}

      {/* list */}
      {listPg.visible(filtered).map((s) => (
        <SnagCard
          key={s.id}
          snag={s}
          workers={workers}
          onEdit={(sn) => setModal({ type: "form", data: sn })}
          onDelete={deleteSnag}
          onStatusChange={statusChange}
          bulkMode={bulkMode}
          selected={selected.has(s.id)}
          onToggleSelect={toggleSelect}
          canDelete={caps.deleteRecords}
        />
      ))}
      {listPg.hasMore(filtered) ? (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          <button type="button" style={ss.btn} onClick={listPg.showMore}>
            Show more ({listPg.remaining(filtered)} remaining)
          </button>
        </div>
      ) : null}

      <div style={{ marginTop:20, padding:"12px 14px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
        Auto-numbered references (SN-001, SN-002…). Add photos directly from phone camera. Export full register to CSV. Data isolated per organisation.
      </div>
    </div>
  );
}
