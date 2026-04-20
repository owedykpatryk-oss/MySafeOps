import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        outletId: "",
        outletType: "Sentinel tap / WHB",
        location: "",
        projectId: "",
        checkDate: today(),
        temperatureC: "",
        flushCompleted: true,
        responsible: "",
        riskAssessmentRef: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 500, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit water check" : "Water hygiene"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>HSG274-style outlet log — align with your written scheme where water systems exist.</p>
        <label style={ss.lbl}>Outlet ID / tag</label>
        <input style={ss.inp} value={form.outletId} onChange={(e) => set("outletId", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Type</label>
        <select style={ss.inp} value={form.outletType} onChange={(e) => set("outletType", e.target.value)}>
          <option value="Sentinel tap / WHB">Sentinel tap / WHB</option>
          <option value="Shower">Shower</option>
          <option value="Tank / calorifier note">Tank / calorifier note</option>
          <option value="Other">Other</option>
        </select>
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
        <input type="date" style={ss.inp} value={form.checkDate} onChange={(e) => set("checkDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Temperature after 1 min (°C) — if measured</label>
        <input style={ss.inp} inputMode="decimal" value={form.temperatureC} onChange={(e) => set("temperatureC", e.target.value)} placeholder="e.g. 50.2" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.flushCompleted} onChange={(e) => set("flushCompleted", e.target.checked)} />
          Flush / purge completed as per scheme
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Responsible person</label>
        <input style={ss.inp} value={form.responsible} onChange={(e) => set("responsible", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Written scheme / RA ref</label>
        <input style={ss.inp} value={form.riskAssessmentRef} onChange={(e) => set("riskAssessmentRef", e.target.value)} />
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

export default function WaterHygieneLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("water_hygiene_log", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("water_hygiene_log", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Outlet", "Type", "Date", "Temp °C", "Flush", "Location", "Project", "Responsible"];
    const rows = items.map((r) => [r.outletId, r.outletType, r.checkDate, r.temperatureC, r.flushCompleted ? "Y" : "N", r.location, r.projectName || "", r.responsible]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `water_hygiene_${today()}.csv`;
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
    pushAudit({ action: isNew ? "water_hygiene_create" : "water_hygiene_update", entity: "water", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="WH"
        title="Water hygiene"
        lead="Outlet temperatures and Legionella-style checks (local only)."
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
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No water hygiene records.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(items) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, items.length)} of {items.length} records
            </div>
          ) : null}
          {listPg.visible(items).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.outletId || "Outlet"}</strong> · {r.checkDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.outletType} · {r.temperatureC ? `${r.temperatureC}°C` : "—"}</div>
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
                          pushAudit({ action: "water_hygiene_delete", entity: "water", detail: r.id });
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
          {listPg.hasMore(items) ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(items)} remaining)
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
