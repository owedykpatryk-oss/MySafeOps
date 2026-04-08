import { useState, useEffect, useCallback } from "react";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

// ─── helpers ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "mysafeops_timesheets";
const WORKERS_KEY = "mysafeops_workers";
const PROJECTS_KEY = "mysafeops_projects";

const load = (key) => loadOrgScoped(key, []);
const save = (key, data) => saveOrgScoped(key, data);

const genId = () => `ts_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

const getWeekStart = (offset = 0) => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(d.setDate(diff));
  monday.setHours(0,0,0,0);
  return monday;
};

const formatDate = (d) =>
  d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });

const weekDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const totalHours = (days) =>
  Object.values(days || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);

const overtime = (h) => Math.max(0, h - 40);

const avatarColor = (name) => {
  const colors = [
    { bg:"#E1F5EE", text:"#085041" },
    { bg:"#E6F1FB", text:"#0C447C" },
    { bg:"#FAEEDA", text:"#633806" },
    { bg:"#EEEDFE", text:"#3C3489" },
    { bg:"#FAECE7", text:"#712B13" },
    { bg:"#EAF3DE", text:"#27500A" },
  ];
  const i = (name || "?").charCodeAt(0) % colors.length;
  return colors[i];
};

const initials = (name) =>
  (name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

const STATUS_COLORS = {
  pending:  { bg:"#FAEEDA", text:"#633806", label:"Pending" },
  approved: { bg:"#EAF3DE", text:"#27500A", label:"Approved" },
  rejected: { bg:"#FCEBEB", text:"#791F1F", label:"Rejected" },
};

// ─── export helpers ──────────────────────────────────────────────────────────
const exportCSV = (entries, workers, projects, weekLabel) => {
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w.name]));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
  const rows = [["Worker","Project","Task","Mon","Tue","Wed","Thu","Fri","Sat","Sun","Total hrs","Overtime","Status"]];
  entries.forEach(e => {
    const d = e.days || {};
    const tot = totalHours(d);
    rows.push([
      workerMap[e.workerId] || e.workerId,
      projectMap[e.projectId] || e.projectId,
      e.task || "",
      d.Mon||0, d.Tue||0, d.Wed||0, d.Thu||0, d.Fri||0, d.Sat||0, d.Sun||0,
      tot.toFixed(1),
      overtime(tot).toFixed(1),
      e.status || "pending",
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `timesheet_${weekLabel.replace(/\s/g,"_")}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

const exportPayroll = (entries, workers, weekLabel) => {
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w.name]));
  const rows = [["Worker","Regular hrs","Overtime hrs","Total hrs"]];
  const byWorker = {};
  entries.filter(e => e.status === "approved").forEach(e => {
    const tot = totalHours(e.days);
    if (!byWorker[e.workerId]) byWorker[e.workerId] = { reg:0, ot:0 };
    const ot = overtime(tot);
    byWorker[e.workerId].ot += ot;
    byWorker[e.workerId].reg += tot - ot;
  });
  Object.entries(byWorker).forEach(([id, v]) => {
    rows.push([workerMap[id]||id, v.reg.toFixed(1), v.ot.toFixed(1), (v.reg+v.ot).toFixed(1)]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `payroll_${weekLabel.replace(/\s/g,"_")}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

// ─── sub-components ──────────────────────────────────────────────────────────

function Avatar({ name, size = 32 }) {
  const c = avatarColor(name);
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:c.bg, color:c.text,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize: size > 32 ? 16 : 12, fontWeight:500, flexShrink:0,
      fontFamily:"DM Sans, sans-serif",
    }}>
      {initials(name)}
    </div>
  );
}

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      padding:"2px 10px", borderRadius:20,
      background:c.bg, color:c.text,
      fontSize:11, fontWeight:500,
    }}>
      {c.label}
    </span>
  );
}

function DayDots({ days }) {
  return (
    <div style={{ display:"flex", gap:3, alignItems:"center" }}>
      {weekDays.map(d => {
        const h = parseFloat(days?.[d] || 0);
        const full = h >= 7.5;
        const half = h > 0 && !full;
        return (
          <div key={d} title={`${d}: ${h}h`} style={{
            width:9, height:9, borderRadius:"50%",
            background: full ? "#1D9E75" : half ? "#EF9F27" : "var(--color-border-secondary, #ccc)",
          }} />
        );
      })}
    </div>
  );
}

function HoursBar({ hours }) {
  const pct = Math.min(100, (hours / 50) * 100);
  const over = hours > 40;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ minWidth:32, fontWeight:500, fontSize:13, color: over ? "#BA7517" : "var(--color-text-primary)" }}>
        {hours.toFixed(1)}
      </span>
      <div style={{ flex:1, height:4, background:"var(--color-border-tertiary,#e5e5e5)", borderRadius:2, minWidth:40 }}>
        <div style={{
          height:4, borderRadius:2, width:`${pct}%`,
          background: over ? "#EF9F27" : "#1D9E75",
          transition:"width .3s",
        }} />
      </div>
    </div>
  );
}

function SummaryCards({ entries }) {
  const allHours = entries.reduce((s, e) => s + totalHours(e.days), 0);
  const allOT = entries.reduce((s, e) => s + overtime(totalHours(e.days)), 0);
  const workers = new Set(entries.map(e => e.workerId)).size;
  const pending = entries.filter(e => e.status === "pending").length;

  const cards = [
    { label:"Total hours", value: allHours.toFixed(0), sub:"this week" },
    { label:"Overtime", value: allOT.toFixed(0), sub:"hours over 40", warn: allOT > 0 },
    { label:"Workers active", value: workers, sub:"with entries" },
    { label:"Pending approval", value: pending, sub:"timesheets", info: pending > 0 },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:10, marginBottom:20 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          background:"var(--color-background-secondary,#f7f7f5)",
          borderRadius:8, padding:"12px 14px",
        }}>
          <div style={{ fontSize:12, color:"var(--color-text-secondary,#888)", marginBottom:4 }}>{c.label}</div>
          <div style={{
            fontSize:22, fontWeight:500,
            color: c.warn ? "#BA7517" : c.info ? "#185FA5" : "var(--color-text-primary)",
          }}>{c.value}</div>
          <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:2 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Entry modal ─────────────────────────────────────────────────────────────
function EntryModal({ entry, workers, projects, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(entry || {
    id: genId(), workerId:"", projectId:"", task:"",
    days:{ Mon:0, Tue:0, Wed:0, Thu:0, Fri:0, Sat:0, Sun:0 },
    status:"pending", notes:"",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const setDay = (d, v) => setForm(f => ({ ...f, days:{ ...f.days, [d]: parseFloat(v)||0 }}));

  const tot = totalHours(form.days);
  const ot = overtime(tot);

  return (
    <div style={{
      minHeight:520, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"1rem",
    }}>
      <div style={{
        background:"var(--color-background-primary,#fff)",
        borderRadius:12, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
        padding:"1.5rem", width:"100%", maxWidth:520,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontWeight:500, fontSize:16 }}>
            {entry ? "Edit entry" : "New timesheet entry"}
          </span>
          <button onClick={onClose} style={{
            background:"none", border:"none", cursor:"pointer",
            color:"var(--color-text-secondary)", fontSize:20, lineHeight:1,
          }}>×</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:12, marginBottom:12 }}>
          <div>
            <label style={labelStyle}>Worker</label>
            <select value={form.workerId} onChange={e=>set("workerId",e.target.value)} style={inputStyle}>
              <option value="">Select worker…</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Project</label>
            <select value={form.projectId} onChange={e=>set("projectId",e.target.value)} style={inputStyle}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={labelStyle}>Task description</label>
          <input value={form.task} onChange={e=>set("task",e.target.value)}
            placeholder="e.g. Cable containment install, Welding works…"
            style={inputStyle} />
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <label style={labelStyle}>Daily hours</label>
            <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
              Total: <strong>{tot.toFixed(1)}h</strong>
              {ot > 0 && <span style={{ color:"#BA7517", marginLeft:6 }}>+{ot.toFixed(1)}h OT</span>}
            </span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
            {weekDays.map(d => (
              <div key={d} style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4, fontWeight:500 }}>{d}</div>
                <input
                  type="number" min={0} max={24} step={0.5}
                  value={form.days[d] || ""}
                  onChange={e=>setDay(d, e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, textAlign:"center", padding:"6px 4px", width:"100%" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)}
            placeholder="Any additional notes…"
            rows={2}
            style={{ ...inputStyle, resize:"vertical", height:"auto", lineHeight:1.5 }}
          />
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:8 }}>
          <div>
            {entry && (
              <button onClick={()=>onDelete(entry.id)} style={{ ...btnStyle, color:"#A32D2D", borderColor:"#F09595" }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            <button onClick={onClose} style={btnStyle}>Cancel</button>
            <button
              onClick={()=>onSave(form)}
              disabled={!form.workerId || !form.projectId}
              style={{ ...btnStyle, background:"#0d9488", color:"#E1F5EE", borderColor:"#085041",
                opacity: (!form.workerId||!form.projectId) ? 0.5 : 1 }}
            >
              Save entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ss = ms;
const labelStyle = ss.lbl;
const inputStyle = ss.inp;
const btnStyle = ss.btn;

// ─── Manage workers/projects panel ──────────────────────────────────────────
function ManagePanel({ type, items, onSave, onClose }) {
  const [list, setList] = useState(items.map(i=>({...i})));
  const [newName, setNewName] = useState("");

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    setList(l => [...l, { id:genId(), name }]);
    setNewName("");
  };

  const remove = (id) => setList(l => l.filter(i=>i.id!==id));
  const rename = (id, name) => setList(l => l.map(i=>i.id===id?{...i,name}:i));

  return (
    <div style={{
      minHeight:400, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem",
    }}>
      <div style={{
        background:"var(--color-background-primary,#fff)",
        borderRadius:12, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
        padding:"1.5rem", width:"100%", maxWidth:400,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontWeight:500, fontSize:16 }}>Manage {type}</span>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",fontSize:20,color:"var(--color-text-secondary)" }}>×</button>
        </div>

        <div style={{ marginBottom:16, maxHeight:240, overflowY:"auto" }}>
          {list.length === 0 && (
            <p style={{ fontSize:13, color:"var(--color-text-secondary)", textAlign:"center", padding:"1rem 0" }}>
              No {type} yet. Add one below.
            </p>
          )}
          {list.map(item => (
            <div key={item.id} style={{
              display:"flex", alignItems:"center", gap:8, marginBottom:8,
            }}>
              <input
                value={item.name}
                onChange={e=>rename(item.id, e.target.value)}
                style={{ ...inputStyle, flex:1 }}
              />
              <button onClick={()=>remove(item.id)} style={{
                ...btnStyle, padding:"7px 10px", color:"#A32D2D", borderColor:"#F09595",
              }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input
            value={newName}
            onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&add()}
            placeholder={`Add new ${type.slice(0,-1)}…`}
            style={{ ...inputStyle, flex:1 }}
          />
          <button onClick={add} style={{ ...btnStyle, background:"#0d9488", color:"#E1F5EE", borderColor:"#085041" }}>
            Add
          </button>
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"flex-end", gap:8 }}>
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          <button onClick={()=>onSave(list)} style={{ ...btnStyle, background:"#0d9488", color:"#E1F5EE", borderColor:"#085041" }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Timesheet() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [modal, setModal] = useState(null); // null | { type:'entry'|'workers'|'projects', data? }
  const [filterWorker, setFilterWorker] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [view, setView] = useState("week"); // 'week' | 'month'

  // load
  useEffect(() => {
    setEntries(load(STORAGE_KEY));
    setWorkers(load(WORKERS_KEY));
    setProjects(load(PROJECTS_KEY));
  }, []);

  // persist
  useEffect(() => { save(STORAGE_KEY, entries); }, [entries]);
  useEffect(() => { save(WORKERS_KEY, workers); }, [workers]);
  useEffect(() => { save(PROJECTS_KEY, projects); }, [projects]);

  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;
  const weekKey = weekStart.toISOString().slice(0,10);

  // filter entries for current week
  const weekEntries = entries.filter(e => e.weekKey === weekKey);

  const filtered = weekEntries.filter(e => {
    if (filterWorker && e.workerId !== filterWorker) return false;
    if (filterProject && e.projectId !== filterProject) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));

  const saveEntry = (form) => {
    const withWeek = { ...form, weekKey };
    setEntries(prev => {
      const exists = prev.find(e=>e.id===form.id);
      return exists
        ? prev.map(e=>e.id===form.id ? withWeek : e)
        : [...prev, withWeek];
    });
    setModal(null);
  };

  const deleteEntry = (id) => {
    setEntries(prev=>prev.filter(e=>e.id!==id));
    setModal(null);
  };

  const updateStatus = (id, status) =>
    setEntries(prev=>prev.map(e=>e.id===id?{...e,status}:e));

  const approveAll = () =>
    setEntries(prev=>prev.map(e=>
      e.weekKey===weekKey && e.status==="pending" ? {...e,status:"approved"} : e
    ));

  const pendingCount = weekEntries.filter(e=>e.status==="pending").length;

  return (
    <div style={{
      fontFamily:"DM Sans, system-ui, sans-serif",
      color:"var(--color-text-primary)",
      padding:"1.25rem 0",
      fontSize:14,
    }}>
      {/* modals */}
      {modal?.type === "entry" && (
        <EntryModal
          entry={modal.data}
          workers={workers}
          projects={projects}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onClose={()=>setModal(null)}
        />
      )}
      {modal?.type === "workers" && (
        <ManagePanel
          type="workers"
          items={workers}
          onSave={w=>{ setWorkers(w); setModal(null); }}
          onClose={()=>setModal(null)}
        />
      )}
      {modal?.type === "projects" && (
        <ManagePanel
          type="projects"
          items={projects}
          onSave={p=>{ setProjects(p); setModal(null); }}
          onClose={()=>setModal(null)}
        />
      )}

      <PageHero
        badgeText="TS"
        title="Timesheet"
        lead="Track and approve worker hours per project (local storage)."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setModal({ type: "workers" })} style={btnStyle}>
              Manage workers
            </button>
            <button type="button" onClick={() => setModal({ type: "projects" })} style={btnStyle}>
              Manage projects
            </button>
            <button
              type="button"
              onClick={() => setModal({ type: "entry" })}
              style={{ ...btnStyle, background: "#0d9488", color: "#E1F5EE", borderColor: "#085041" }}
            >
              + Log hours
            </button>
          </div>
        }
      />

      {/* pending banner */}
      {pendingCount > 0 && (
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 14px",
          background:"#E6F1FB", borderRadius:8,
          border:"0.5px solid #B5D4F4",
          marginBottom:16, flexWrap:"wrap", gap:8,
        }}>
          <span style={{ fontSize:13, color:"#0C447C" }}>
            {pendingCount} timesheet{pendingCount>1?"s":""} awaiting approval this week
          </span>
          <div style={{ display:"flex", gap:8 }}>
            <button
              onClick={approveAll}
              style={{ padding:"5px 12px", borderRadius:6, border:"none",
                background:"#0d9488", color:"#E1F5EE", fontSize:12, cursor:"pointer" }}
            >
              Approve all
            </button>
            <button
              onClick={()=>setFilterStatus("pending")}
              style={{ padding:"5px 12px", borderRadius:6, fontSize:12, cursor:"pointer",
                background:"var(--color-background-primary,#fff)",
                border:"0.5px solid var(--color-border-secondary,#ccc)",
                color:"var(--color-text-primary)" }}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* week nav */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={{ ...btnStyle, padding:"5px 10px" }}>‹</button>
          <span style={{ fontSize:14, fontWeight:500, minWidth:240, textAlign:"center" }}>
            Week {weekOffset===0?"(current)":weekOffset>0?`+${weekOffset}`:weekOffset} — {weekLabel}
          </span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={{ ...btnStyle, padding:"5px 10px" }}>›</button>
          {weekOffset!==0 && (
            <button onClick={()=>setWeekOffset(0)} style={{ ...btnStyle, fontSize:12, padding:"5px 10px" }}>Today</button>
          )}
        </div>
      </div>

      {/* filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <select value={filterWorker} onChange={e=>setFilterWorker(e.target.value)} style={{ ...inputStyle, width:"auto" }}>
          <option value="">All workers</option>
          {workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{ ...inputStyle, width:"auto" }}>
          <option value="">All projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...inputStyle, width:"auto" }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {(filterWorker||filterProject||filterStatus) && (
          <button
            onClick={()=>{ setFilterWorker(""); setFilterProject(""); setFilterStatus(""); }}
            style={{ ...btnStyle, fontSize:12 }}
          >Clear filters</button>
        )}
      </div>

      {/* summary */}
      {weekEntries.length > 0 && <SummaryCards entries={weekEntries} />}

      {/* empty states */}
      {workers.length === 0 && (
        <div style={{ textAlign:"center", padding:"2rem 1rem",
          border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, marginBottom:16 }}>
          <p style={{ fontSize:14, color:"var(--color-text-secondary)", marginBottom:12 }}>
            No workers added yet. Start by adding your team.
          </p>
          <button onClick={()=>setModal({type:"workers"})} style={{ ...btnStyle, background:"#0d9488", color:"#E1F5EE", borderColor:"#085041" }}>
            Add workers
          </button>
        </div>
      )}

      {workers.length > 0 && projects.length === 0 && (
        <div style={{ textAlign:"center", padding:"2rem 1rem",
          border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, marginBottom:16 }}>
          <p style={{ fontSize:14, color:"var(--color-text-secondary)", marginBottom:12 }}>
            No projects yet. Add your first project to start logging hours.
          </p>
          <button onClick={()=>setModal({type:"projects"})} style={{ ...btnStyle, background:"#0d9488", color:"#E1F5EE", borderColor:"#085041" }}>
            Add projects
          </button>
        </div>
      )}

      {/* table */}
      {workers.length > 0 && projects.length > 0 && (
        <div style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:12, overflow:"hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding:"2.5rem", textAlign:"center" }}>
              <p style={{ color:"var(--color-text-secondary)", fontSize:13 }}>
                {weekEntries.length === 0
                  ? "No hours logged for this week yet."
                  : "No entries match your filters."}
              </p>
              {weekEntries.length === 0 && (
                <button
                  onClick={()=>setModal({type:"entry"})}
                  style={{ ...btnStyle, marginTop:12, background:"#0d9488", color:"#E1F5EE", borderColor:"#085041" }}
                >
                  + Log first entry
                </button>
              )}
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"var(--color-background-secondary,#f7f7f5)" }}>
                  {["Worker","Project","Task","Days","Hours","Status",""].map(h=>(
                    <th key={h} style={{
                      padding:"8px 12px", textAlign:"left",
                      fontSize:11, fontWeight:500, color:"var(--color-text-secondary)",
                      borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const wName = workerMap[e.workerId] || e.workerId;
                  const pName = projectMap[e.projectId] || e.projectId;
                  const hrs = totalHours(e.days);
                  return (
                    <tr key={e.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                      <td style={{ padding:"10px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <Avatar name={wName} size={28} />
                          <span style={{ fontWeight:500 }}>{wName}</span>
                        </div>
                      </td>
                      <td style={{ padding:"10px 12px", color:"var(--color-text-secondary)" }}>{pName}</td>
                      <td style={{ padding:"10px 12px", color:"var(--color-text-secondary)", maxWidth:160,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {e.task || "—"}
                      </td>
                      <td style={{ padding:"10px 12px" }}><DayDots days={e.days} /></td>
                      <td style={{ padding:"10px 12px", minWidth:100 }}><HoursBar hours={hrs} /></td>
                      <td style={{ padding:"10px 12px" }}>
                        <select
                          value={e.status||"pending"}
                          onChange={ev=>updateStatus(e.id, ev.target.value)}
                          style={{ ...inputStyle, width:"auto", padding:"3px 8px", fontSize:12 }}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td style={{ padding:"10px 12px" }}>
                        <button
                          onClick={()=>setModal({type:"entry", data:e})}
                          style={{ ...btnStyle, padding:"4px 10px", fontSize:12 }}
                        >Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* add row */}
          {workers.length > 0 && projects.length > 0 && (
            <div
              onClick={()=>setModal({type:"entry"})}
              style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px", cursor:"pointer",
                borderTop:"0.5px dashed var(--color-border-tertiary,#e5e5e5)",
                color:"var(--color-text-secondary)",
                fontSize:13,
              }}
              onMouseEnter={e=>{ e.currentTarget.style.background="var(--color-background-secondary,#f7f7f5)"; e.currentTarget.style.color="var(--color-text-primary)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=""; e.currentTarget.style.color="var(--color-text-secondary)"; }}
            >
              <div style={{
                width:18, height:18, borderRadius:"50%",
                border:"1.5px solid currentColor",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:14, lineHeight:1,
              }}>+</div>
              Add timesheet entry
            </div>
          )}
        </div>
      )}

      {/* export */}
      {weekEntries.length > 0 && (
        <>
          <div style={{
            fontSize:11, fontWeight:500, color:"var(--color-text-secondary)",
            letterSpacing:"0.06em", textTransform:"uppercase",
            margin:"1.25rem 0 0.5rem",
          }}>Export options</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {[
              {
                label:"CSV (all entries)",
                icon:<path d="M4 2h8v12H4zM7 5h2M7 8h2M7 11h4M11 9l2 2-2 2" />,
                action:()=>exportCSV(weekEntries, workers, projects, weekLabel),
              },
              {
                label:"Payroll export",
                icon:<><path d="M8 2v9M5 8l3 3 3-3"/><path d="M3 13h10"/></>,
                action:()=>exportPayroll(weekEntries, workers, weekLabel),
                note:"approved only",
              },
              {
                label:"Monthly summary",
                icon:<><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 7h12M6 3V1M10 3V1"/></>,
                action:()=>{
                  const monthEntries = entries.filter(e => {
                    if (!e.weekKey) return false;
                    const d = new Date(e.weekKey);
                    const now = new Date();
                    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
                  });
                  exportCSV(monthEntries, workers, projects, `month_${new Date().toISOString().slice(0,7)}`);
                },
              },
            ].map(b=>(
              <button key={b.label} onClick={b.action} style={{
                ...btnStyle, display:"flex", alignItems:"center", gap:6,
              }}>
                <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  {b.icon}
                </svg>
                {b.label}
                {b.note && <span style={{ fontSize:10, color:"var(--color-text-secondary)", marginLeft:2 }}>({b.note})</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* footer note */}
      <p style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:20, lineHeight:1.5 }}>
        Data stored per organisation — each account sees only its own workers, projects and timesheets.
        Workers and projects are managed independently by each organisation.
      </p>
    </div>
  );
}
