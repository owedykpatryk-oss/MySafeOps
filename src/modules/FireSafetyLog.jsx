import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `fire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

const TYPES = ["Fire extinguisher", "Fire alarm test", "Emergency lighting", "Assembly point signage", "Fire door", "Other"];

function Form({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        checkType: "Fire extinguisher",
        location: "",
        checkDate: today(),
        satisfactory: true,
        checkedBy: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 500, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit fire check" : "Fire safety check"}</h2>
        <label style={ss.lbl}>Check type</label>
        <select style={ss.inp} value={form.checkType} onChange={(e) => set("checkType", e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Location</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date</label>
        <input type="date" style={ss.inp} value={form.checkDate} onChange={(e) => set("checkDate", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.satisfactory} onChange={(e) => set("satisfactory", e.target.checked)} />
          Satisfactory
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Checked by</label>
        <input style={ss.inp} value={form.checkedBy} onChange={(e) => set("checkedBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes / actions</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave(form)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FireSafetyLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("fire_safety_log", []));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save("fire_safety_log", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Date", "Type", "Location", "OK", "Checked by", "Notes"];
    const rows = items.map((r) => [r.checkDate, r.checkType, r.location, r.satisfactory ? "yes" : "no", r.checkedBy, r.notes]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `fire_safety_${today()}.csv`;
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
    pushAudit({ action: isNew ? "fire_check_create" : "fire_check_update", entity: "fire", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="FIRE"
        title="Fire safety log"
        lead="Drills, extinguishers, alarms, and fire marshal records (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add check
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No fire checks recorded.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} style={ss.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.checkType}</strong> · {r.checkDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.location} · {r.satisfactory ? "OK" : "Action required"}</div>
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
                          pushAudit({ action: "fire_check_delete", entity: "fire", detail: r.id });
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
