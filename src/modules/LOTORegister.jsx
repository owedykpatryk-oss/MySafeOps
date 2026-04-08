import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `loto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        equipmentId: "",
        isolationPoint: "",
        projectId: "",
        appliedDate: today(),
        appliedBy: "",
        removedDate: "",
        removedBy: "",
        status: "locked",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit LOTO" : "Lock out / tag out"}</h2>
        <label style={ss.lbl}>Equipment / circuit ID</label>
        <input style={ss.inp} value={form.equipmentId} onChange={(e) => set("equipmentId", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Isolation point / description</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.isolationPoint} onChange={(e) => set("isolationPoint", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Locks applied date</label>
        <input type="date" style={ss.inp} value={form.appliedDate} onChange={(e) => set("appliedDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Applied by</label>
        <input style={ss.inp} value={form.appliedBy} onChange={(e) => set("appliedBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Status</label>
        <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="locked">Locked / isolated</option>
          <option value="removed">Removed / energised</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Removal date (if cleared)</label>
        <input type="date" style={ss.inp} value={form.removedDate || ""} onChange={(e) => set("removedDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Removed by</label>
        <input style={ss.inp} value={form.removedBy} onChange={(e) => set("removedBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 40, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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

export default function LOTORegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("loto_register", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save("loto_register", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Equipment", "Isolation", "Project", "Applied", "By", "Status", "Removed", "Removed by"];
    const rows = items.map((r) => [r.equipmentId, r.isolationPoint, r.projectName || "", r.appliedDate, r.appliedBy, r.status, r.removedDate, r.removedBy]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `loto_register_${today()}.csv`;
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
    pushAudit({ action: isNew ? "loto_create" : "loto_update", entity: "loto", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="LOTO"
        title="LOTO register"
        lead="Lock-out tag-out points and isolations (local only)."
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
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No LOTO records.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} style={ss.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.equipmentId || "Equipment"}</strong> · {r.status}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.appliedDate} · {r.appliedBy}</div>
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
                          pushAudit({ action: "loto_delete", entity: "loto", detail: r.id });
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
