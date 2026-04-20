import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `asb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        location: "",
        buildingArea: "",
        projectId: "",
        surveyRef: "",
        materialDescription: "",
        asbestosType: "Presumed",
        riskAssessmentRef: "",
        lastReviewDate: today(),
        nextReviewDate: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit asbestos item" : "Asbestos register entry"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Supports HSG264-style location records on site. Keep aligned with your survey and management plan.</p>
        <label style={ss.lbl}>Location / room / level</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Building / zone</label>
        <input style={ss.inp} value={form.buildingArea} onChange={(e) => set("buildingArea", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Survey / re-inspection ref</label>
        <input style={ss.inp} value={form.surveyRef} onChange={(e) => set("surveyRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Material / product description</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.materialDescription} onChange={(e) => set("materialDescription", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Classification</label>
        <select style={ss.inp} value={form.asbestosType} onChange={(e) => set("asbestosType", e.target.value)}>
          <option value="Presumed">Presumed ACM</option>
          <option value="Confirmed">Confirmed ACM</option>
          <option value="Not ACM">Not ACM (negative result)</option>
          <option value="Strong presumption">Strong presumption</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Risk assessment / AMP ref</label>
        <input style={ss.inp} value={form.riskAssessmentRef} onChange={(e) => set("riskAssessmentRef", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Last review</label>
            <input type="date" style={ss.inp} value={form.lastReviewDate} onChange={(e) => set("lastReviewDate", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Next review due</label>
            <input type="date" style={ss.inp} value={form.nextReviewDate || ""} onChange={(e) => set("nextReviewDate", e.target.value)} />
          </div>
        </div>
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

export default function AsbestosRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("asbestos_register", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("asbestos_register", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Location", "Building", "Project", "Survey ref", "Material", "Type", "RA ref", "Last review", "Next review"];
    const rows = items.map((r) => [r.location, r.buildingArea, r.projectName || "", r.surveyRef, r.materialDescription, r.asbestosType, r.riskAssessmentRef, r.lastReviewDate, r.nextReviewDate]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `asbestos_register_${today()}.csv`;
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
    pushAudit({ action: isNew ? "asbestos_create" : "asbestos_update", entity: "asbestos", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="ASB"
        title="Asbestos register"
        lead="ACM locations, surveys, and management plan refs (local only)."
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
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No asbestos register items yet.</div>
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
                  <strong>{r.location || "Location"}</strong> · {r.asbestosType}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.materialDescription?.slice(0, 100) || "—"}</div>
                  {r.nextReviewDate && <div style={{ fontSize: 11, marginTop: 4 }}>Next review: {r.nextReviewDate}</div>}
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
                          pushAudit({ action: "asbestos_delete", entity: "asbestos", detail: r.id });
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
