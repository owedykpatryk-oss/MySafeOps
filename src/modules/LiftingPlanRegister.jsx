import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `lift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        liftRef: "",
        loadDescription: "",
        weightEstimate: "",
        craneOrLift: "",
        projectId: "",
        liftDate: today(),
        appointedPerson: "",
        slingerSignaller: "",
        liftSupervisor: "",
        methodStatementRef: "",
        briefingDone: false,
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit lifting plan" : "Lifting operation"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Brief log — LOLER / BS7121 duties remain with competent persons on site.</p>
        <label style={ss.lbl}>Lift reference</label>
        <input style={ss.inp} value={form.liftRef} onChange={(e) => set("liftRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Load / task</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.loadDescription} onChange={(e) => set("loadDescription", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Est. weight / SWL note</label>
        <input style={ss.inp} value={form.weightEstimate} onChange={(e) => set("weightEstimate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Crane / hoist / telehandler</label>
        <input style={ss.inp} value={form.craneOrLift} onChange={(e) => set("craneOrLift", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Lift date</label>
        <input type="date" style={ss.inp} value={form.liftDate} onChange={(e) => set("liftDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Appointed person</label>
        <input style={ss.inp} value={form.appointedPerson} onChange={(e) => set("appointedPerson", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Crane supervisor / lift supervisor</label>
        <input style={ss.inp} value={form.liftSupervisor} onChange={(e) => set("liftSupervisor", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Slinger / signaller</label>
        <input style={ss.inp} value={form.slingerSignaller} onChange={(e) => set("slingerSignaller", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>RAMS / method statement ref</label>
        <input style={ss.inp} value={form.methodStatementRef} onChange={(e) => set("methodStatementRef", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.briefingDone} onChange={(e) => set("briefingDone", e.target.checked)} />
          Pre-lift briefing completed
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 44, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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

export default function LiftingPlanRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("lifting_plan_register", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save("lifting_plan_register", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Ref", "Date", "Load", "Plant", "Project", "AP", "Supervisor", "Briefing", "RAMS ref"];
    const rows = items.map((r) => [r.liftRef, r.liftDate, r.loadDescription, r.craneOrLift, r.projectName || "", r.appointedPerson, r.liftSupervisor, r.briefingDone ? "yes" : "no", r.methodStatementRef]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `lifting_operations_${today()}.csv`;
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
    pushAudit({ action: isNew ? "lifting_create" : "lifting_update", entity: "lifting", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="LIFT"
        title="Lifting operations"
        lead="Lift plans, equipment, and briefings (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add lift
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No lifting records.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} style={ss.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.liftRef || "Lift"}</strong> · {r.liftDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.loadDescription?.slice(0, 90) || "—"}</div>
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
                          pushAudit({ action: "lifting_delete", entity: "lifting", detail: r.id });
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
