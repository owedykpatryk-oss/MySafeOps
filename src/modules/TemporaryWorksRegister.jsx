import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `tw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

const CATEGORIES = ["Propping / needling", "Façade retention", "Formwork / falsework", "Excavation support", "Tower crane base", "Other TW"];

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        twRef: "",
        description: "",
        category: "Propping / needling",
        designBriefRef: "",
        checkerCatRef: "",
        location: "",
        projectId: "",
        inspectionDate: today(),
        nextCheckDue: "",
        inspector: "",
        status: "in_use",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 540, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit temporary works" : "Temporary works"}</h2>
        <label style={ss.lbl}>TW reference</label>
        <input style={ss.inp} value={form.twRef} onChange={(e) => set("twRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Description</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.description} onChange={(e) => set("description", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Category</label>
        <select style={ss.inp} value={form.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Design / check certificate ref</label>
        <input style={ss.inp} value={form.designBriefRef} onChange={(e) => set("designBriefRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>TWC / independent check ref</label>
        <input style={ss.inp} value={form.checkerCatRef} onChange={(e) => set("checkerCatRef", e.target.value)} />
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Inspection date</label>
            <input type="date" style={ss.inp} value={form.inspectionDate} onChange={(e) => set("inspectionDate", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Next check</label>
            <input type="date" style={ss.inp} value={form.nextCheckDue || ""} onChange={(e) => set("nextCheckDue", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Inspector (TWS or competent)</label>
        <input style={ss.inp} value={form.inspector} onChange={(e) => set("inspector", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Status</label>
        <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="in_use">In use</option>
          <option value="struck">Struck / removed</option>
          <option value="hold">On hold</option>
        </select>
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

export default function TemporaryWorksRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("temporary_works_register", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Syncing: d1Items } = useD1OrgArraySync({
    storageKey: "temporary_works_register",
    namespace: "temporary_works_register",
    value: items,
    setValue: setItems,
    load,
    save,
  });
  const { d1Syncing: d1Proj } = useD1OrgArraySync({
    storageKey: "mysafeops_projects",
    namespace: "mysafeops_projects",
    value: projects,
    setValue: setProjects,
    load,
    save,
  });
  const d1Syncing = d1Items || d1Proj;

  const exportCsv = () => {
    const h = ["Ref", "Category", "Date", "Location", "Project", "Inspector", "Status", "Next"];
    const rows = items.map((r) => [r.twRef, r.category, r.inspectionDate, r.location, r.projectName || "", r.inspector, r.status, r.nextCheckDue]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `temporary_works_${today()}.csv`;
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
    pushAudit({ action: isNew ? "temp_works_create" : "temp_works_update", entity: "temp_works", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {d1Syncing ? (
        <div
          className="app-panel-surface"
          style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}
        >
          Syncing temporary works register with cloud…
        </div>
      ) : null}
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="TW"
        title="Temporary works"
        lead="TW design checks and inspections (local only)."
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
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No temporary works records.</div>
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
                  <strong>{r.twRef || "TW"}</strong> · {r.category}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.inspectionDate} · {r.status}</div>
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
                          pushAudit({ action: "temp_works_delete", entity: "temp_works", detail: r.id });
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
