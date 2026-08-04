import { useState } from "react";
import ModuleOverlay from "../components/ModuleOverlay";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import RegisterModuleShell from "../components/RegisterModuleShell";
import RegisterFormPrintButton from "../components/RegisterFormPrintButton";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { exportCsv } from "../utils/exportCsv";
import { validateRequiredFields } from "../utils/registerPersistGuard";

import { todayLocalISO } from "../utils/localDate";
const genId = () => `dsear_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

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
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 560 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit DSEAR entry" : "DSEAR / dangerous substances"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Summary log — full DSEAR risk assessment and zoning must be on file where substances create fire/explosion risk.</p>
        <label style={ss.lbl} htmlFor="dsear-substance-or-area">Substance or work area</label>
        <input style={ss.inp} value={form.substanceOrArea} onChange={(e) => set("substanceOrArea", e.target.value)}  id="dsear-substance-or-area" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="dsear-hazard-class">Hazard type</label>
        <select style={ss.inp} value={form.hazardClass} onChange={(e) => set("hazardClass", e.target.value)} id="dsear-hazard-class">
          <option value="Flammable liquid">Flammable liquid</option>
          <option value="Flammable gas">Flammable gas</option>
          <option value="Combustible dust">Combustible dust</option>
          <option value="Oxidiser">Oxidiser</option>
          <option value="Other ATEX-relevant">Other ATEX-relevant</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="dsear-project-id">Project / site</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="dsear-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="dsear-zone-classification">Zone / classification note</label>
        <input style={ss.inp} value={form.zoneClassification} onChange={(e) => set("zoneClassification", e.target.value)} placeholder="e.g. Zone 2, extraction"  id="dsear-zone-classification" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="dsear-assessment-ref">DSEAR / risk assessment ref</label>
        <input style={ss.inp} value={form.assessmentRef} onChange={(e) => set("assessmentRef", e.target.value)}  id="dsear-assessment-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="dsear-control-measures">Key control measures</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.controlMeasures} onChange={(e) => set("controlMeasures", e.target.value)}  id="dsear-control-measures" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="dsear-review-date">Review date</label>
            <input type="date" style={ss.inp} value={form.reviewDate} onChange={(e) => set("reviewDate", e.target.value)}  id="dsear-review-date" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="dsear-next-review-date">Next review</label>
            <input type="date" style={ss.inp} value={form.nextReviewDate || ""} onChange={(e) => set("nextReviewDate", e.target.value)}  id="dsear-next-review-date" />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="dsear-competent-person">Competent person / responsible</label>
        <input style={ss.inp} value={form.competentPerson} onChange={(e) => set("competentPerson", e.target.value)}  id="dsear-competent-person" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="dsear-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 40, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="dsear-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["substanceOrArea"], { substanceOrArea: "Substance or work area" });
            if (!check.ok) { window.alert(check.message); return; }
            onSave(payload);
          }}>
            Save
          </button>
        </div>
      </div>
    </ModuleOverlay>
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

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Substance/area", "Hazard", "Project", "Zone", "Assessment ref", "Review", "Next", "Responsible"];
    const rows = liveItems.map((r) => [r.substanceOrArea, r.hazardClass, r.projectName || "", r.zoneClassification, r.assessmentRef, r.reviewDate, r.nextReviewDate, r.competentPerson]);
    exportCsv(h, rows, `dsear_register_${today()}.csv`);
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
            <PageHero exportModuleId="dsear"
        badgeText="DS"
        title="DSEAR register"
        lead="Dangerous substances and explosive atmospheres records (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add entry
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="dsear"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("dsear", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="⚠️"
          title="No DSEAR entries yet"
          description="Record dangerous substances, zones and control measures for explosive atmospheres."
          actionLabel="+ Add entry"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.substanceOrArea || "Entry"}</strong> · {r.hazardClass}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.zoneClassification || r.assessmentRef}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="dsear" record={r} />
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    Edit
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (
                          softDeleteToRecycleBin({
                            moduleId: "dsear",
                            moduleLabel: "DSEAR register",
                            itemType: "dsear_entry",
                            itemLabel: r.substanceOrArea || r.hazardClass || r.id,
                            sourceKey: "dsear_register",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
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
          <RegisterListPagingFooter
            hasMore={listPg.hasMore(liveItems)}
            remaining={listPg.remaining(liveItems)}
            showing={Math.min(listPg.cap, liveItems.length)}
            total={liveItems.length}
            onShowMore={listPg.showMore}
            buttonStyle={ss.btn}
          />
        </div>
      )}

      </RegisterModuleShell>    </div>
  );
}
