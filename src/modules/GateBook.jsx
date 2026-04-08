import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `gate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        visitDate: today(),
        timeIn: "08:00",
        timeOut: "",
        vehicleReg: "",
        company: "",
        driverName: "",
        deliveryRef: "",
        purpose: "Delivery",
        projectId: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 540, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit gate entry" : "Gate / vehicle book"}</h2>
        <label style={ss.lbl}>Date</label>
        <input type="date" style={ss.inp} value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Time in</label>
            <input type="time" style={ss.inp} value={form.timeIn} onChange={(e) => set("timeIn", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Time out</label>
            <input type="time" style={ss.inp} value={form.timeOut || ""} onChange={(e) => set("timeOut", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Vehicle registration</label>
        <input style={ss.inp} value={form.vehicleReg} onChange={(e) => set("vehicleReg", e.target.value.toUpperCase())} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Company / haulier</label>
        <input style={ss.inp} value={form.company} onChange={(e) => set("company", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Driver</label>
        <input style={ss.inp} value={form.driverName} onChange={(e) => set("driverName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Purpose</label>
        <select style={ss.inp} value={form.purpose} onChange={(e) => set("purpose", e.target.value)}>
          <option value="Delivery">Delivery</option>
          <option value="Collection">Collection</option>
          <option value="Waste">Waste</option>
          <option value="Visitor vehicle">Visitor vehicle</option>
          <option value="Other">Other</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Delivery note / ref</label>
        <input style={ss.inp} value={form.deliveryRef} onChange={(e) => set("deliveryRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project / gate</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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

export default function GateBook() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("gate_book", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save("gate_book", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Date", "In", "Out", "Reg", "Company", "Driver", "Purpose", "DN ref", "Project", "Notes"];
    const rows = items.map((r) => [r.visitDate, r.timeIn, r.timeOut, r.vehicleReg, r.company, r.driverName, r.purpose, r.deliveryRef, r.projectName || "", r.notes]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `gate_book_${today()}.csv`;
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
    pushAudit({ action: isNew ? "gate_create" : "gate_update", entity: "gate", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="GT"
        title="Gate book"
        lead="Site gate movements and deliveries (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add entry
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No gate entries yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} style={ss.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.vehicleReg}</strong> · {r.visitDate} {r.timeIn}
                  {r.timeOut ? `–${r.timeOut}` : ""}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.company} · {r.purpose}</div>
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
                          pushAudit({ action: "gate_delete", entity: "gate", detail: r.id });
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
