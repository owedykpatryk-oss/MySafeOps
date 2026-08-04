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
const genId = () => `tw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

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
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 540 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit temporary works" : "Temporary works"}</h2>
        <label style={ss.lbl} htmlFor="temporary-works-tw-ref">TW reference</label>
        <input style={ss.inp} value={form.twRef} onChange={(e) => set("twRef", e.target.value)}  id="temporary-works-tw-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-description">Description</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.description} onChange={(e) => set("description", e.target.value)}  id="temporary-works-description" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-category">Category</label>
        <select style={ss.inp} value={form.category} onChange={(e) => set("category", e.target.value)} id="temporary-works-category">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-design-brief-ref">Design / check certificate ref</label>
        <input style={ss.inp} value={form.designBriefRef} onChange={(e) => set("designBriefRef", e.target.value)}  id="temporary-works-design-brief-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-checker-cat-ref">TWC / independent check ref</label>
        <input style={ss.inp} value={form.checkerCatRef} onChange={(e) => set("checkerCatRef", e.target.value)}  id="temporary-works-checker-cat-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-location">Location</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)}  id="temporary-works-location" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="temporary-works-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="temporary-works-inspection-date">Inspection date</label>
            <input type="date" style={ss.inp} value={form.inspectionDate} onChange={(e) => set("inspectionDate", e.target.value)}  id="temporary-works-inspection-date" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="temporary-works-next-check-due">Next check</label>
            <input type="date" style={ss.inp} value={form.nextCheckDue || ""} onChange={(e) => set("nextCheckDue", e.target.value)}  id="temporary-works-next-check-due" />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-inspector">Inspector (TWS or competent)</label>
        <input style={ss.inp} value={form.inspector} onChange={(e) => set("inspector", e.target.value)}  id="temporary-works-inspector" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-status">Status</label>
        <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)} id="temporary-works-status">
          <option value="in_use">In use</option>
          <option value="struck">Struck / removed</option>
          <option value="hold">On hold</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="temporary-works-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 40, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="temporary-works-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["description","location"], { description: "Description", location: "Location" });
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

export default function TemporaryWorksRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("temporary_works_register", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "temporary_works_register",
    namespace: "temporary_works_register",
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
    const h = ["Ref", "Category", "Date", "Location", "Project", "Inspector", "Status", "Next"];
    const rows = liveItems.map((r) => [r.twRef, r.category, r.inspectionDate, r.location, r.projectName || "", r.inspector, r.status, r.nextCheckDue]);
    exportCsv(h, rows, `temporary_works_${today()}.csv`);
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
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="temporary works register" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="temp-works"
        badgeText="TW"
        title="Temporary works"
        lead="TW design checks and inspections — register exports to PDF from the header."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add record
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="temp-works"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("temp-works", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🧱"
          title="No temporary works records"
          description="Log TW designs, checks and inspections for the site register."
          actionLabel="+ Add record"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.twRef || "TW"}</strong> · {r.category}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.inspectionDate} · {r.status}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="temp-works" record={r} />
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
                            moduleId: "temp-works",
                            moduleLabel: "Temporary works",
                            itemType: "temp_works",
                            itemLabel: r.twRef || r.category || r.id,
                            sourceKey: "temporary_works_register",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
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
