import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const genId = () => `dsear_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        substanceOrArea: "",
        hazardClass: "Flammable liquid",
        projectId: "",
        zoneClassification: "",
        assessmentRef: "",
        controlMeasures: "",
        reviewDate: today(),
        nextReviewDate: "",
        competentPerson: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit DSEAR entry" : "DSEAR / dangerous substances"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Summary log — full DSEAR risk assessment and zoning must be on file where substances create fire/explosion risk.</p>
        <label style={ss.lbl}>Substance or work area</label>
        <input style={ss.inp} value={form.substanceOrArea} onChange={(e) => set("substanceOrArea", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Hazard type</label>
        <select style={ss.inp} value={form.hazardClass} onChange={(e) => set("hazardClass", e.target.value)}>
          <option value="Flammable liquid">Flammable liquid</option>
          <option value="Flammable gas">Flammable gas</option>
          <option value="Combustible dust">Combustible dust</option>
          <option value="Oxidiser">Oxidiser</option>
          <option value="Other ATEX-relevant">Other ATEX-relevant</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project / site</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Zone / classification note</label>
        <input style={ss.inp} value={form.zoneClassification} onChange={(e) => set("zoneClassification", e.target.value)} placeholder="e.g. Zone 2, extraction" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>DSEAR / risk assessment ref</label>
        <input style={ss.inp} value={form.assessmentRef} onChange={(e) => set("assessmentRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Key control measures</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.controlMeasures} onChange={(e) => set("controlMeasures", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Review date</label>
            <input type="date" style={ss.inp} value={form.reviewDate} onChange={(e) => set("reviewDate", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Next review</label>
            <input type="date" style={ss.inp} value={form.nextReviewDate || ""} onChange={(e) => set("nextReviewDate", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Competent person / responsible</label>
        <input style={ss.inp} value={form.competentPerson} onChange={(e) => set("competentPerson", e.target.value)} />
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

export default function DSEARLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("dsear_register", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "dsear_register",
    namespace: "dsear_register",
    value: items,
    setValue: setItems,
    load,
    save,
  });
  const { d1Hydrating: d1ProjH, d1OutboxPending: d1ProjO } = useD1OrgArraySync({
    storageKey: "mysafeops_projects",
    namespace: "mysafeops_projects",
    value: projects,
    setValue: setProjects,
    load,
    save,
  });
  const d1Hydrating = d1ItemsH || d1ProjH;
  const d1OutboxPending = d1ItemsO || d1ProjO;

  const exportCsv = () => {
    const h = ["Substance/area", "Hazard", "Project", "Zone", "Assessment ref", "Review", "Next", "Responsible"];
    const rows = items.map((r) => [r.substanceOrArea, r.hazardClass, r.projectName || "", r.zoneClassification, r.assessmentRef, r.reviewDate, r.nextReviewDate, r.competentPerson]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `dsear_register_${today()}.csv`;
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
    pushAudit({ action: isNew ? "dsear_create" : "dsear_update", entity: "dsear", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="DSEAR register" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="DS"
        title="DSEAR register"
        lead="Dangerous substances and explosive atmospheres records (local only)."
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
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No DSEAR entries.</div>
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
                  <strong>{r.substanceOrArea || "Entry"}</strong> · {r.hazardClass}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.zoneClassification || r.assessmentRef}</div>
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
                          pushAudit({ action: "dsear_delete", entity: "dsear", detail: r.id });
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
