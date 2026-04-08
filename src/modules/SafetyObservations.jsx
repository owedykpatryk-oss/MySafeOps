import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        polarity: "positive",
        obsDate: today(),
        projectId: "",
        location: "",
        detail: "",
        observer: "",
        actionTaken: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit observation" : "Safety observation"}</h2>
        <label style={ss.lbl}>Type</label>
        <select style={ss.inp} value={form.polarity} onChange={(e) => set("polarity", e.target.value)}>
          <option value="positive">Positive (good practice)</option>
          <option value="at_risk">At-risk behaviour / condition</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date</label>
        <input type="date" style={ss.inp} value={form.obsDate} onChange={(e) => set("obsDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Location / activity</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>What was observed</label>
        <textarea style={{ ...ss.inp, minHeight: 72, resize: "vertical" }} value={form.detail} onChange={(e) => set("detail", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Observer</label>
        <input style={ss.inp} value={form.observer} onChange={(e) => set("observer", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Discussion / action (optional)</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.actionTaken} onChange={(e) => set("actionTaken", e.target.value)} />
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

export default function SafetyObservations() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("safety_observations", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save("safety_observations", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Date", "Type", "Project", "Location", "Detail", "Observer", "Action"];
    const rows = items.map((r) => [r.obsDate, r.polarity === "positive" ? "positive" : "at_risk", r.projectName || "", r.location, r.detail, r.observer, r.actionTaken]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `safety_observations_${today()}.csv`;
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
    pushAudit({ action: isNew ? "observation_create" : "observation_update", entity: "observation", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="OBS"
        title="Safety observations"
        lead="Positive interventions and unsafe act observations (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add observation
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No observations yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} style={{ ...ss.card, borderLeft: `4px solid ${r.polarity === "positive" ? "#0d9488" : "#ea580c"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.polarity === "positive" ? "Positive" : "At risk"}</strong> · {r.obsDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.location}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>{r.detail}</div>
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
                          pushAudit({ action: "observation_delete", entity: "observation", detail: r.id });
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
