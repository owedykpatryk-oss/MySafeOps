import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `lw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        workerName: "",
        task: "",
        location: "",
        projectId: "",
        workDate: today(),
        startTime: "08:00",
        expectedEnd: "17:00",
        contactNumber: "",
        signedOff: false,
        signedOffAt: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 540, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit lone working" : "Lone working record"}</h2>
        <label style={ss.lbl}>Person</label>
        <input style={ss.inp} value={form.workerName} onChange={(e) => set("workerName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Task</label>
        <input style={ss.inp} value={form.task} onChange={(e) => set("task", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Location</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date</label>
        <input type="date" style={ss.inp} value={form.workDate} onChange={(e) => set("workDate", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Start</label>
            <input type="time" style={ss.inp} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Expected finish</label>
            <input type="time" style={ss.inp} value={form.expectedEnd} onChange={(e) => set("expectedEnd", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Check-in contact number</label>
        <input style={ss.inp} inputMode="tel" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.signedOff} onChange={(e) => set("signedOff", e.target.checked)} />
          Signed off / task completed safely
        </label>
        {form.signedOff && (
          <>
            <label style={{ ...ss.lbl, marginTop: 10 }}>Signed off at (optional)</label>
            <input type="datetime-local" style={ss.inp} value={form.signedOffAt || ""} onChange={(e) => set("signedOffAt", e.target.value)} />
          </>
        )}
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave({ ...form, projectName: pm[form.projectId] || "" })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoneWorkingLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("lone_working_log", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save("lone_working_log", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Date", "Person", "Task", "Location", "Project", "Start", "End", "Contact", "Signed off", "Notes"];
    const rows = items.map((r) => [r.workDate, r.workerName, r.task, r.location, r.projectName || "", r.startTime, r.expectedEnd, r.contactNumber, r.signedOff ? "yes" : "no", r.notes]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `lone_working_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const persist = (f, isNew) => {
    setItems((p) => {
      const i = p.findIndex((x) => x.id === f.id);
      if (i >= 0) {
        const n = [...p];
        n[i] = f;
        return n;
      }
      return [f, ...p];
    });
    pushAudit({ action: isNew ? "lone_working_create" : "lone_working_update", entity: "lone_working", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="LW"
        title="Lone working"
        lead="Check-ins and lone worker welfare records (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add record
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No lone working records.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} style={ss.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.workerName}</strong> · {r.workDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.task} · {r.location}</div>
                  {!r.signedOff && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Not signed off</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    Edit
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (confirm("Delete?")) {
                          setItems((p) => p.filter((x) => x.id !== r.id));
                          pushAudit({ action: "lone_working_delete", entity: "lone_working", detail: r.id });
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
