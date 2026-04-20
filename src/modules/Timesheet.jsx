import { useState, useEffect, useMemo } from "react";
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

/** ISO 8601 week number; `isoYear` is the ISO year (year of that week's Thursday). */
const isoWeekMetaFromMonday = (monday) => {
  const date = new Date(monday.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { week: Math.max(1, Math.min(53, week)), isoYear: date.getFullYear() };
};

const weekDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const cardShell = {
  borderRadius: 12,
  border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
  background: "var(--color-background-primary,#fff)",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 28px rgba(15, 23, 42, 0.06)",
};

const totalHours = (days) =>
  Object.values(days || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);

const overtime = (h) => Math.max(0, h - 40);

/** Sum hours per worker across entries (same week). */
const hoursTotalsByWorker = (list) => {
  const m = {};
  (list || []).forEach((e) => {
    const t = totalHours(e.days);
    m[e.workerId] = (m[e.workerId] || 0) + t;
  });
  return m;
};

/** Total overtime hours for the week: each worker gets max(0, sum−40) once. */
const overtimeHoursAcrossWorkers = (list) => {
  return Object.values(hoursTotalsByWorker(list)).reduce((s, h) => s + overtime(h), 0);
};

const parseWeekKeyLocal = (weekKey) => {
  if (!weekKey || typeof weekKey !== "string") return null;
  const p = weekKey.split("-").map(Number);
  if (p.length !== 3 || p.some(Number.isNaN)) return null;
  return new Date(p[0], p[1] - 1, p[2]);
};

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
const UTF8_BOM = "\uFEFF";

const csvEscape = (c) => `"${String(c ?? "").replace(/"/g, '""')}"`;

const downloadCsv = (filename, rows) => {
  const csv = UTF8_BOM + rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadJson = (filename, data) => {
  const blob = new Blob([UTF8_BOM + JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const exportCSV = (entries, workers, projects, weekLabel) => {
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w.name]));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
  const rows = [["Worker","Project","Task","Mon","Tue","Wed","Thu","Fri","Sat","Sun","Total hrs","Overtime (row)","Status","Reject reason","Notes"]];
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
      e.rejectReason || "",
      e.notes || "",
    ]);
  });
  downloadCsv(`timesheet_${weekLabel.replace(/\s/g,"_")}.csv`, rows);
};

/** Approved entries only — same columns as full CSV. */
const exportApprovedCSV = (entries, workers, projects, weekLabel) => {
  exportCSV(entries.filter(e => e.status === "approved"), workers, projects, `${weekLabel}_approved`);
};

const exportPayroll = (entries, workers, weekLabel) => {
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w.name]));
  const rows = [["Worker","Regular hrs","Overtime hrs","Total hrs"]];
  const approved = entries.filter(e => e.status === "approved");
  const totals = hoursTotalsByWorker(approved);
  Object.entries(totals).forEach(([id, tot]) => {
    const ot = overtime(tot);
    const reg = tot - ot;
    rows.push([workerMap[id] || id, reg.toFixed(1), ot.toFixed(1), tot.toFixed(1)]);
  });
  downloadCsv(`payroll_${weekLabel.replace(/\s/g,"_")}.csv`, rows);
};

/** One row per worker: total hours, OT (40h cap per worker), #lines. */
const exportWorkerSummaryCSV = (entries, workers, weekLabel) => {
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w.name]));
  const counts = {};
  entries.forEach((e) => { counts[e.workerId] = (counts[e.workerId] || 0) + 1; });
  const totals = hoursTotalsByWorker(entries);
  const rows = [["Worker","Total hrs","Overtime (40h cap)","# entries"]];
  Object.entries(totals).forEach(([id, tot]) => {
    rows.push([
      workerMap[id] || id,
      tot.toFixed(1),
      overtime(tot).toFixed(1),
      counts[id] || 0,
    ]);
  });
  downloadCsv(`timesheet_workers_${weekLabel.replace(/\s/g,"_")}.csv`, rows);
};

/** One row per project: total hours, distinct workers, #lines. */
const exportProjectSummaryCSV = (entries, projects, weekLabel) => {
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
  const byProject = {};
  entries.forEach((e) => {
    const t = totalHours(e.days);
    if (!byProject[e.projectId]) byProject[e.projectId] = { hours: 0, workers: new Set(), n: 0 };
    byProject[e.projectId].hours += t;
    byProject[e.projectId].workers.add(e.workerId);
    byProject[e.projectId].n += 1;
  });
  const rows = [["Project","Total hrs","# workers","# entries"]];
  Object.entries(byProject).forEach(([id, v]) => {
    rows.push([
      projectMap[id] || id,
      v.hours.toFixed(1),
      v.workers.size,
      v.n,
    ]);
  });
  downloadCsv(`timesheet_projects_${weekLabel.replace(/\s/g,"_")}.csv`, rows);
};

const exportWeekJson = (entries, workers, projects, weekLabel, weekKey) => {
  downloadJson(`timesheet_${weekKey}.json`, {
    exportedAt: new Date().toISOString(),
    weekLabel,
    weekKey,
    workers,
    projects,
    entries,
  });
};

const entriesInCalendarMonth = (allEntries, yyyymm) => {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return [];
  return (allEntries || []).filter((e) => {
    const d = parseWeekKeyLocal(e.weekKey);
    return d && d.getFullYear() === y && d.getMonth() === m - 1;
  });
};

/** Sum each weekday across a list of entries (for footer totals). */
const sumDailyHours = (list) => {
  const acc = Object.fromEntries(weekDays.map((d) => [d, 0]));
  (list || []).forEach((e) => {
    weekDays.forEach((d) => {
      acc[d] += parseFloat(e.days?.[d] || 0) || 0;
    });
  });
  return acc;
};

const calendarDayLabel = (weekStartMonday, weekdayName) => {
  const i = weekDays.indexOf(weekdayName);
  if (i < 0) return "";
  const x = new Date(weekStartMonday);
  x.setDate(x.getDate() + i);
  return x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** Human-readable checks: heavy worker weeks, heavy site days. */
const buildTimesheetWarnings = (list, workerMap) => {
  const msgs = [];
  const totals = hoursTotalsByWorker(list);
  Object.entries(totals).forEach(([id, h]) => {
    if (h > 48) msgs.push(`${workerMap[id] || id}: ${h.toFixed(1)}h this week (>48h)`);
  });
  const daySite = sumDailyHours(list);
  weekDays.forEach((d) => {
    if (daySite[d] > 14) msgs.push(`${d}: ${daySite[d].toFixed(1)}h total on site (>14h)`);
  });
  return msgs;
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

function SortTh({ id, label, sortKey, sortAsc, onSort }) {
  const active = sortKey === id;
  const title = active
    ? `${label}: sorted ${sortAsc ? "ascending" : "descending"} — click to reverse`
    : `${label}: click to sort (stable tie-break by row id)`;
  return (
    <th key={id} style={{
      padding:"10px 12px", textAlign:"left",
      fontSize:11, fontWeight:600, color:"var(--color-text-secondary)",
      borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
      whiteSpace:"nowrap",
      letterSpacing:"0.02em",
      background:"#ecefec",
    }}>
      <button
        type="button"
        title={title}
        onClick={() => onSort(id)}
        style={{
          background:active ? "var(--color-background-secondary,#f0fdfa)" : "none",
          border:"none", borderRadius:6, padding:"4px 6px", margin:"-4px -6px", cursor:"pointer",
          font:"inherit", color:"inherit", display:"inline-flex", alignItems:"center", gap:5,
          transition:"background .15s ease",
        }}
      >
        {label}
        {active ? <span style={{ fontSize:10, opacity:0.9, color:"#0d9488" }}>{sortAsc ? "▲" : "▼"}</span> : <span style={{ fontSize:10, opacity:0.35 }}>↕</span>}
      </button>
    </th>
  );
}

function HoursBar({ hours, title: barTitle }) {
  const pct = Math.min(100, (hours / 50) * 100);
  const over = hours > 40;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }} title={barTitle}>
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
  const allOT = overtimeHoursAcrossWorkers(entries);
  const workers = new Set(entries.map(e => e.workerId)).size;
  const pending = entries.filter(e => e.status === "pending").length;

  const cards = [
    { label:"Total hours", value: allHours.toFixed(0), sub:"this week" },
    { label:"Overtime", value: allOT.toFixed(0), sub:"over 40h per worker", warn: allOT > 0 },
    { label:"Workers active", value: workers, sub:"with entries" },
    { label:"Pending approval", value: pending, sub:"timesheets", info: pending > 0 },
  ];

  return (
    <div style={{
      display:"grid",
      gridTemplateColumns:"repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
      gap:12,
      marginBottom:20,
    }}>
      {cards.map(c => (
        <div key={c.label} style={{
          ...cardShell,
          background:"var(--color-background-secondary,#f8faf9)",
          padding:"14px 16px",
          transition:"transform .15s ease, box-shadow .15s ease",
        }}>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary,#888)", marginBottom:6, letterSpacing:"0.04em", textTransform:"uppercase" }}>{c.label}</div>
          <div style={{
            fontSize:24, fontWeight:600, letterSpacing:"-0.02em",
            color: c.warn ? "#BA7517" : c.info ? "#185FA5" : "var(--color-text-primary)",
          }}>{c.value}</div>
          <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:4, lineHeight:1.35 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Entry modal ─────────────────────────────────────────────────────────────
function EntryModal({ entry, weekStartMonday, workers, projects, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => entry ? {
    ...entry,
    rejectReason: entry.rejectReason || "",
    notes: entry.notes || "",
  } : {
    id: genId(), workerId:"", projectId:"", task:"",
    days:{ Mon:0, Tue:0, Wed:0, Thu:0, Fri:0, Sat:0, Sun:0 },
    status:"pending", notes:"", rejectReason:"",
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
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2, fontWeight:500 }}>{d}</div>
                <div style={{ fontSize:10, color:"var(--color-text-tertiary,#aaa)", marginBottom:4 }}>
                  {weekStartMonday ? calendarDayLabel(weekStartMonday, d) : ""}
                </div>
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

        {entry && (
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>Status</label>
            <select
              value={form.status || "pending"}
              onChange={(e) => set("status", e.target.value)}
              style={{ ...inputStyle, marginBottom: form.status === "rejected" ? 10 : 0 }}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {form.status === "rejected" && (
              <>
                <label style={{ ...labelStyle, marginTop:10 }}>Reject reason</label>
                <textarea
                  value={form.rejectReason || ""}
                  onChange={(e) => set("rejectReason", e.target.value)}
                  placeholder="Why was this line rejected?"
                  rows={2}
                  style={{ ...inputStyle, resize:"vertical", height:"auto", lineHeight:1.5 }}
                />
              </>
            )}
          </div>
        )}

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
              onClick={() => onSave({
                ...form,
                rejectReason: form.status === "rejected" ? String(form.rejectReason || "").trim() : "",
              })}
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
  const [filterTask, setFilterTask] = useState("");
  const [exportMonth, setExportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [sortKey, setSortKey] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
  const isoMeta = isoWeekMetaFromMonday(weekStart);

  // filter entries for current week
  const weekEntries = entries.filter(e => e.weekKey === weekKey);

  const taskNeedle = filterTask.trim().toLowerCase();
  const filtered = weekEntries.filter(e => {
    if (filterWorker && e.workerId !== filterWorker) return false;
    if (filterProject && e.projectId !== filterProject) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    if (taskNeedle && !(e.task || "").toLowerCase().includes(taskNeedle)) return false;
    return true;
  });

  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    if (!sortKey) return arr;
    const wm = Object.fromEntries(workers.map((w) => [w.id, w.name]));
    const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const statusOrder = { pending: 0, approved: 1, rejected: 2 };
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "worker":
          cmp = (wm[a.workerId] || "").localeCompare(wm[b.workerId] || "", undefined, { sensitivity: "base" });
          break;
        case "project":
          cmp = (pm[a.projectId] || "").localeCompare(pm[b.projectId] || "", undefined, { sensitivity: "base" });
          break;
        case "task":
          cmp = (a.task || "").localeCompare(b.task || "", undefined, { sensitivity: "base" });
          break;
        case "hours":
          cmp = totalHours(a.days) - totalHours(b.days);
          break;
        case "status":
          cmp = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
          break;
        default:
          return 0;
      }
      if (cmp !== 0) return sortAsc ? cmp : -cmp;
      return String(a.id).localeCompare(String(b.id));
    });
    return arr;
  }, [filtered, sortKey, sortAsc, workers, projects]);

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

  const duplicateEntry = (e) => {
    const clone = {
      ...e,
      id: genId(),
      weekKey,
      status: "pending",
      rejectReason: "",
    };
    setEntries((prev) => [...prev, clone]);
  };

  const refreshRosterFromStorage = () => {
    setWorkers(load(WORKERS_KEY));
    setProjects(load(PROJECTS_KEY));
  };

  const handleSortColumn = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortAsc(true);
    } else {
      setSortAsc((a) => !a);
    }
  };

  const updateStatus = (id, status) =>
    setEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      return { ...e, status, rejectReason: status === "rejected" ? (e.rejectReason || "") : "" };
    }));

  const approveAll = () =>
    setEntries(prev=>prev.map(e=>
      e.weekKey===weekKey && e.status==="pending" ? {...e,status:"approved"} : e
    ));

  const pendingCount = weekEntries.filter(e=>e.status==="pending").length;

  const copyFromPreviousWeek = () => {
    const prevStart = getWeekStart(weekOffset - 1);
    const prevKey = prevStart.toISOString().slice(0, 10);
    const prevEntries = entries.filter((e) => e.weekKey === prevKey);
    if (!prevEntries.length) return;
    if (weekEntries.length > 0) {
      const ok = typeof window !== "undefined" && window.confirm(
        "This week already has entries. Copy last week anyway? (Adds extra lines; you can edit or delete.)"
      );
      if (!ok) return;
    }
    const clones = prevEntries.map((e) => ({
      ...e,
      id: genId(),
      weekKey,
      status: "pending",
      rejectReason: "",
    }));
    setEntries((prev) => [...prev, ...clones]);
  };

  const prevWeekStart = getWeekStart(weekOffset - 1);
  const prevWeekKey = prevWeekStart.toISOString().slice(0, 10);
  const prevWeekHasEntries = entries.some((e) => e.weekKey === prevWeekKey);

  const workerWeekTotals = hoursTotalsByWorker(weekEntries);
  const filteredDayTotals = sumDailyHours(filtered);
  const filteredHoursSum = filtered.reduce((s, e) => s + totalHours(e.days), 0);
  const weekWarnings = weekEntries.length ? buildTimesheetWarnings(weekEntries, workerMap) : [];

  const weekTotalHoursAll = weekEntries.reduce((s, e) => s + totalHours(e.days), 0);
  const workersWithEntries = new Set(weekEntries.map((e) => e.workerId)).size;
  const nominalWeekCapacity = Math.max(40, workersWithEntries * 40);
  const weekLoadRatio = weekTotalHoursAll / nominalWeekCapacity;
  const weekLoadPct = Math.min(100, Math.round(weekLoadRatio * 100));
  const weekLoadOver = weekLoadRatio > 1;

  const filterChips = [];
  if (filterWorker) filterChips.push({ key: "w", label: `Worker: ${workerMap[filterWorker] || filterWorker}`, clear: () => setFilterWorker("") });
  if (filterProject) filterChips.push({ key: "p", label: `Project: ${projectMap[filterProject] || filterProject}`, clear: () => setFilterProject("") });
  if (filterStatus) filterChips.push({ key: "s", label: `Status: ${filterStatus}`, clear: () => setFilterStatus("") });
  if (taskNeedle) filterChips.push({ key: "t", label: `Task: “${filterTask.trim()}”`, clear: () => setFilterTask("") });

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
          key={(modal.data && modal.data.id) || "new-entry"}
          entry={modal.data}
          weekStartMonday={weekStart}
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
        lead="Track and approve worker hours per project. Workers and projects are the same lists as elsewhere in the workspace (local keys mysafeops_workers / mysafeops_projects — RAMS, permits, toolbox talks, etc.)."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={refreshRosterFromStorage}
              style={btnStyle}
              title="Reload workers and projects from storage (e.g. after editing them elsewhere)"
            >
              Refresh lists
            </button>
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
              type="button"
              onClick={approveAll}
              style={{ padding:"5px 12px", borderRadius:6, border:"none",
                background:"#0d9488", color:"#E1F5EE", fontSize:12, cursor:"pointer" }}
            >
              Approve all
            </button>
            <button
              type="button"
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

      {/* week nav — elevated toolbar */}
      <div style={{ ...cardShell, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <button type="button" onClick={()=>setWeekOffset(w=>w-1)} style={{ ...btnStyle, padding:"6px 12px", fontWeight:600 }} aria-label="Previous week">‹</button>
            <div style={{ textAlign:"center", minWidth:200 }}>
              <div style={{ fontSize:15, fontWeight:600, color:"var(--color-text-primary)", letterSpacing:"-0.01em" }}>
                {weekLabel}
              </div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                <span title="Monday start date for stored rows">Week key <code style={{ fontSize:10 }}>{weekKey}</code></span>
                <span style={{ opacity:0.5 }}>·</span>
                <span>ISO week <strong>{isoMeta.week}</strong> · {isoMeta.isoYear}</span>
                {weekOffset !== 0 ? (
                  <>
                    <span style={{ opacity:0.5 }}>·</span>
                    <span>{weekOffset > 0 ? `+${weekOffset}` : weekOffset} from today</span>
                  </>
                ) : (
                  <>
                <span style={{ opacity:0.5 }}>·</span>
                <span style={{ color:"#0d9488", fontWeight:600 }}>Current week</span>
                  </>
                )}
                {weekEntries.length > 0 && (
                  <>
                    <span style={{ opacity:0.5 }}>·</span>
                    <span title="Lines stored for this weekKey">{weekEntries.length} entr{weekEntries.length === 1 ? "y" : "ies"}</span>
                  </>
                )}
              </div>
            </div>
            <button type="button" onClick={()=>setWeekOffset(w=>w+1)} style={{ ...btnStyle, padding:"6px 12px", fontWeight:600 }} aria-label="Next week">›</button>
            {weekOffset!==0 && (
              <button type="button" onClick={()=>setWeekOffset(0)} style={{ ...btnStyle, fontSize:12, padding:"6px 12px" }}>This week</button>
            )}
          </div>
          {prevWeekHasEntries && (
            <button
              type="button"
              onClick={copyFromPreviousWeek}
              style={{ ...btnStyle, fontSize:12, padding:"6px 14px" }}
              title="Duplicate all lines from the previous calendar week into this week (new IDs, status pending)"
            >
              Copy from last week
            </button>
          )}
        </div>
        {weekEntries.length > 0 && (
          <div style={{ marginTop:14, paddingTop:12, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6, flexWrap:"wrap", gap:8 }}>
              <span style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.04em", textTransform:"uppercase" }}>
                Week load vs nominal capacity
              </span>
              <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                <strong style={{ color: weekLoadOver ? "#b91c1c" : "var(--color-text-primary)" }}>
                  {weekTotalHoursAll.toFixed(1)}h
                </strong>
                {" / "}
                {nominalWeekCapacity}h
                <span style={{ fontWeight:600, marginLeft:6, color: weekLoadOver ? "#b91c1c" : "var(--color-text-secondary)" }}>
                  ({Math.round(weekLoadRatio * 100)}%)
                </span>
                <span style={{ color:"var(--color-text-tertiary)", marginLeft:6 }}>nominal 40h × {workersWithEntries || 1} worker{workersWithEntries !== 1 ? "s" : ""} with entries</span>
              </span>
            </div>
            <div style={{ height:8, borderRadius:99, background:"var(--color-border-tertiary,#e8e8e6)", overflow:"hidden" }}>
              <div style={{
                width:`${weekLoadPct}%`, height:"100%", borderRadius:99,
                background: weekLoadOver ? "#dc2626" : weekLoadPct > 85 ? "#EA580C" : "linear-gradient(90deg, #0d9488, #14b8a6)",
                transition:"width .35s ease",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* filters */}
      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap", alignItems:"center" }}>
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
        <input
          type="search"
          value={filterTask}
          onChange={(e) => setFilterTask(e.target.value)}
          placeholder="Search task…"
          style={{ ...inputStyle, minWidth:160, flex:1, maxWidth:280 }}
        />
        {(filterWorker||filterProject||filterStatus||filterTask.trim()) && (
          <button
            type="button"
            onClick={()=>{ setFilterWorker(""); setFilterProject(""); setFilterStatus(""); setFilterTask(""); }}
            style={{ ...btnStyle, fontSize:12 }}
          >Clear filters</button>
        )}
        {sortKey && (
          <button
            type="button"
            onClick={() => { setSortKey(""); setSortAsc(true); }}
            style={{ ...btnStyle, fontSize:12 }}
            title="Return to default row order"
          >
            Clear sort
          </button>
        )}
      </div>

      <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:600, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:"0.05em", marginRight:4 }}>Status</span>
        {[
          { value: "", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ].map((opt) => {
          const on = filterStatus === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setFilterStatus(opt.value)}
              style={{
                fontSize:12,
                fontWeight:600,
                padding:"5px 12px",
                borderRadius:999,
                border:`0.5px solid ${on ? "#0f766e" : "var(--color-border-secondary,#ccc)"}`,
                background: on ? "linear-gradient(180deg, #ccfbf1, #b2f5ea)" : "var(--color-background-primary,#fff)",
                color: on ? "#064e3b" : "var(--color-text-secondary)",
                cursor:"pointer",
                boxShadow: on ? "0 1px 2px rgba(13,148,136,0.15)" : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {filterChips.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", marginBottom:14 }}>
          <span style={{ fontSize:11, fontWeight:600, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Active</span>
          {filterChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              style={{
                display:"inline-flex", alignItems:"center", gap:6,
                fontSize:12, fontWeight:500,
                padding:"5px 10px 5px 12px",
                borderRadius:999,
                border:"0.5px solid var(--color-border-secondary,#d4d4d4)",
                background:"var(--color-background-secondary,#f4f4f2)",
                color:"var(--color-text-primary)",
                cursor:"pointer",
              }}
              title="Remove filter"
            >
              {c.label}
              <span style={{ fontSize:14, lineHeight:1, opacity:0.55 }} aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom:16 }}>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          style={{
            ...btnStyle,
            fontSize:12,
            padding:"6px 12px",
            display:"inline-flex",
            alignItems:"center",
            gap:6,
            borderColor:"var(--color-border-secondary,#ccc)",
          }}
          aria-expanded={advancedOpen}
        >
          <span style={{ fontWeight:600 }}>Advanced</span>
          <span style={{ fontSize:10, opacity:0.7 }}>{advancedOpen ? "▼" : "▶"}</span>
          <span style={{ fontSize:11, color:"var(--color-text-secondary)", fontWeight:400 }}>sorting, rules, exports</span>
        </button>
        {advancedOpen && (
          <div style={{ ...cardShell, marginTop:10, padding:"14px 16px", fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>
            <ul style={{ margin:0, paddingLeft:18 }}>
              <li><strong>Sort</strong> — click column headers (Worker, Project, Task, Hours, Status). First click ascending, second descending. Equal values stay ordered by row id.</li>
              <li><strong>Overtime card</strong> — sums hours over <strong>40h per worker per week</strong> (all their lines combined).</li>
              <li><strong>Review suggested</strong> — flags any worker over <strong>48h</strong> or any single day over <strong>14h</strong> site-wide (all rows).</li>
              <li><strong>Row tint</strong> — light highlight when that worker&apos;s week total exceeds <strong>40h</strong>.</li>
              <li><strong>Duplicate</strong> — copies one line (new id, pending, clears reject reason). <strong>Copy from last week</strong> copies the whole previous week.</li>
              <li><strong>Refresh lists</strong> — reloads <code style={{ fontSize:11 }}>mysafeops_workers</code> / <code style={{ fontSize:11 }}>mysafeops_projects</code> from storage without reloading the page.</li>
              <li><strong>Exports</strong> — CSV with UTF-8 BOM for Excel; payroll uses approved hours only, 40h cap per worker; JSON backup is the full week payload.</li>
              <li><strong>Quick status</strong> — pill buttons filter by pending / approved / rejected (same as the status dropdown).</li>
              <li><strong>Clear sort</strong> — restores default row order after sorting by column.</li>
            </ul>
          </div>
        )}
      </div>

      {/* summary */}
      {weekEntries.length > 0 && <SummaryCards entries={weekEntries} />}

      {weekWarnings.length > 0 && (
        <div style={{
          ...cardShell,
          marginBottom:16, padding:"12px 16px",
          background:"linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          borderColor:"#fcd34d",
          fontSize:12, color:"#633806", lineHeight:1.45,
        }}>
          <strong style={{ display:"block", marginBottom:6, letterSpacing:"0.02em" }}>Review suggested</strong>
          <ul style={{ margin:0, paddingLeft:18 }}>
            {weekWarnings.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

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
        <div style={{ ...cardShell, overflow:"hidden" }}>
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
            <div style={{ overflowX:"auto", overflowY:"auto", maxHeight:"min(62vh, 520px)", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", minWidth:720, borderCollapse:"collapse", fontSize:13 }}>
              <thead style={{ position:"sticky", top:0, zIndex:3 }}>
                <tr style={{
                  background:"linear-gradient(180deg, var(--color-background-secondary,#f4f6f5) 0%, #ecefec 100%)",
                  boxShadow:"0 1px 0 rgba(15,23,42,0.06)",
                }}>
                  <SortTh id="worker" label="Worker" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSortColumn} />
                  <SortTh id="project" label="Project" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSortColumn} />
                  <SortTh id="task" label="Task" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSortColumn} />
                  <th style={{
                    padding:"10px 12px", textAlign:"left",
                    fontSize:11, fontWeight:600, color:"var(--color-text-secondary)",
                    borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
                    letterSpacing:"0.02em",
                    background:"#ecefec",
                  }} title="Visual Mon–Sun; sort other columns">Days</th>
                  <SortTh id="hours" label="Hours" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSortColumn} />
                  <SortTh id="status" label="Status" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSortColumn} />
                  <th style={{
                    padding:"10px 12px", textAlign:"left", width:1,
                    fontSize:11, fontWeight:600, color:"var(--color-text-secondary)",
                    borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
                    background:"#ecefec",
                  }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((e, rowIdx) => {
                  const wName = workerMap[e.workerId] || e.workerId;
                  const pName = projectMap[e.projectId] || e.projectId;
                  const hrs = totalHours(e.days);
                  const wk = workerWeekTotals[e.workerId] ?? hrs;
                  const barTitle = `This line: ${hrs.toFixed(1)}h — worker week total: ${wk.toFixed(1)}h`;
                  const heavyWorkerWeek = wk > 40;
                  const stripe = !heavyWorkerWeek && rowIdx % 2 === 1 ? "rgba(15,23,42,0.025)" : undefined;
                  return (
                    <tr key={e.id} style={{
                      borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
                      background: heavyWorkerWeek ? "rgba(239, 159, 39, 0.09)" : stripe,
                      transition:"background .12s ease",
                    }}>
                      <td style={{ padding:"10px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <Avatar name={wName} size={28} />
                          <span style={{ fontWeight:500 }}>{wName}</span>
                        </div>
                      </td>
                      <td style={{ padding:"10px 12px", color:"var(--color-text-secondary)" }}>{pName}</td>
                      <td style={{ padding:"10px 12px", color:"var(--color-text-secondary)", maxWidth:200, verticalAlign:"top" }}>
                        <div style={{ fontWeight:400 }}>{e.task || "—"}</div>
                        {e.status === "rejected" && e.rejectReason ? (
                          <div style={{
                            fontSize:11, color:"#791F1F", marginTop:4, lineHeight:1.35,
                            whiteSpace:"pre-wrap", wordBreak:"break-word",
                          }} title={e.rejectReason}>{e.rejectReason}</div>
                        ) : null}
                        {e.status === "rejected" && !e.rejectReason ? (
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>
                            Use Edit to add a reject reason.
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding:"10px 12px" }}><DayDots days={e.days} /></td>
                      <td style={{ padding:"10px 12px", minWidth:100 }}><HoursBar hours={hrs} title={barTitle} /></td>
                      <td style={{ padding:"10px 12px", verticalAlign:"middle" }}>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:6 }}>
                          <Badge status={e.status || "pending"} />
                          <select
                            value={e.status||"pending"}
                            onChange={ev=>updateStatus(e.id, ev.target.value)}
                            style={{ ...inputStyle, width:"auto", padding:"3px 8px", fontSize:12 }}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </td>
                      <td style={{ padding:"10px 12px" }}>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                          <button
                            type="button"
                            onClick={()=>setModal({type:"entry", data:e})}
                            style={{ ...btnStyle, padding:"4px 10px", fontSize:12 }}
                          >Edit</button>
                          <button
                            type="button"
                            onClick={()=>duplicateEntry(e)}
                            title="Copy this line for this week (new row, pending)"
                            style={{ ...btnStyle, padding:"4px 10px", fontSize:12 }}
                          >Duplicate</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{
                  background:"var(--color-background-secondary,#f7f7f5)",
                  fontWeight:500,
                  fontSize:12,
                  color:"var(--color-text-secondary)",
                }}>
                  <td colSpan={3} style={{ padding:"10px 12px", borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                    Totals ({filtered.length} row{filtered.length !== 1 ? "s" : ""}
                    {taskNeedle || filterWorker || filterProject || filterStatus ? ", filtered" : ""})
                  </td>
                  <td style={{ padding:"10px 12px", borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)", verticalAlign:"middle" }}>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {weekDays.map((d) => (
                        <span key={d} title={`${d} total`} style={{ fontSize:10, minWidth:22, textAlign:"center" }}>
                          <span style={{ display:"block", color:"var(--color-text-tertiary,#aaa)", fontWeight:500 }}>{d}</span>
                          <span style={{ color:"var(--color-text-primary)" }}>{filteredDayTotals[d].toFixed(1)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding:"10px 12px", borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)", color:"var(--color-text-primary)" }}>
                    {filteredHoursSum.toFixed(1)}h
                  </td>
                  <td colSpan={2} style={{ padding:"10px 12px", borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }} />
                </tr>
              </tbody>
            </table>
            </div>
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
        <div style={{ ...cardShell, marginTop:20, padding:"16px 18px" }}>
          <div style={{
            fontSize:11, fontWeight:600, color:"var(--color-text-secondary)",
            letterSpacing:"0.08em", textTransform:"uppercase",
            marginBottom:8,
          }}>Export &amp; reporting</div>
          <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"0 0 12px", lineHeight:1.5 }}>
            CSV files include a UTF-8 BOM for Excel. Payroll uses each worker&apos;s <strong>total approved hours</strong> for the week, then splits regular vs overtime above 40h.
          </p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            {[
              {
                label:"CSV (all entries)",
                icon:<path d="M4 2h8v12H4zM7 5h2M7 8h2M7 11h4M11 9l2 2-2 2" />,
                action:()=>exportCSV(weekEntries, workers, projects, weekLabel),
              },
              {
                label:"CSV (approved only)",
                icon:<path d="M4 2h8v12H4zM6 8l2 2 4-4" />,
                action:()=>exportApprovedCSV(weekEntries, workers, projects, weekLabel),
              },
              {
                label:"Worker summary",
                icon:<path d="M8 3a2 2 0 100 4 2 2 0 000-4zM4 14c0-2 2-3.5 4-3.5s4 1.5 4 3.5" />,
                action:()=>exportWorkerSummaryCSV(weekEntries, workers, weekLabel),
                note:"per worker",
              },
              {
                label:"Project summary",
                icon:<path d="M2 4h5v9H2zM9 2h5v11H9z" />,
                action:()=>exportProjectSummaryCSV(weekEntries, projects, weekLabel),
                note:"per project",
              },
              {
                label:"Payroll export",
                icon:<><path d="M8 2v9M5 8l3 3 3-3"/><path d="M3 13h10"/></>,
                action:()=>exportPayroll(weekEntries, workers, weekLabel),
                note:"approved only",
              },
              {
                label:"JSON (backup)",
                icon:<path d="M5 3h6v10H5zM7 6h2M7 9h4" />,
                action:()=>exportWeekJson(weekEntries, workers, projects, weekLabel, weekKey),
              },
            ].map(b=>(
              <button key={b.label} type="button" onClick={b.action} style={{
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
          <div style={{
            display:"flex", flexWrap:"wrap", gap:8, alignItems:"center",
            marginTop:12, padding:"10px 12px",
            background:"var(--color-background-secondary,#f7f7f5)",
            borderRadius:8,
            border:"0.5px solid var(--color-border-tertiary,#e5e5e5)",
          }}>
            <span style={{ fontSize:12, fontWeight:500, color:"var(--color-text-secondary)" }}>Month CSV</span>
            <input
              type="month"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              style={{ ...inputStyle, width:"auto", fontSize:13 }}
            />
            <button
              type="button"
              onClick={() => {
                const monthEntries = entriesInCalendarMonth(entries, exportMonth);
                if (!monthEntries.length) {
                  if (typeof window !== "undefined") window.alert("No timesheet weeks in that month.");
                  return;
                }
                exportCSV(monthEntries, workers, projects, `month_${exportMonth}`);
              }}
              style={{ ...btnStyle, display:"flex", alignItems:"center", gap:6 }}
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="2" y="3" width="12" height="11" rx="1" />
                <path d="M2 7h12M6 3V1M10 3V1" />
              </svg>
              Download month
            </button>
            <span style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)" }}>
              All lines whose week starts in the selected month
            </span>
          </div>
        </div>
      )}

      {/* footer note */}
      <p style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:20, lineHeight:1.5 }}>
        Data stored per organisation — each account sees only its own workers, projects and timesheets.
        Workers and projects are managed independently by each organisation.
      </p>
    </div>
  );
}
