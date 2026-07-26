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
const genId = () => `lift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        liftRef: "",
        loadDescription: "",
        weightEstimate: "",
        craneOrLift: "",
        projectId: "",
        liftDate: today(),
        appointedPerson: "",
        slingerSignaller: "",
        liftSupervisor: "",
        methodStatementRef: "",
        briefingDone: false,
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 560 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit lifting plan" : "Lifting operation"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Brief log — LOLER / BS7121 duties remain with competent persons on site.</p>
        <label style={ss.lbl} htmlFor="lifting-plan-lift-ref">Lift reference</label>
        <input style={ss.inp} value={form.liftRef} onChange={(e) => set("liftRef", e.target.value)}  id="lifting-plan-lift-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-load-description">Load / task</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.loadDescription} onChange={(e) => set("loadDescription", e.target.value)}  id="lifting-plan-load-description" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-weight-estimate">Est. weight / SWL note</label>
        <input style={ss.inp} value={form.weightEstimate} onChange={(e) => set("weightEstimate", e.target.value)}  id="lifting-plan-weight-estimate" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-crane-or-lift">Crane / hoist / telehandler</label>
        <input style={ss.inp} value={form.craneOrLift} onChange={(e) => set("craneOrLift", e.target.value)}  id="lifting-plan-crane-or-lift" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="lifting-plan-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-lift-date">Lift date</label>
        <input type="date" style={ss.inp} value={form.liftDate} onChange={(e) => set("liftDate", e.target.value)}  id="lifting-plan-lift-date" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-appointed-person">Appointed person</label>
        <input style={ss.inp} value={form.appointedPerson} onChange={(e) => set("appointedPerson", e.target.value)}  id="lifting-plan-appointed-person" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-lift-supervisor">Crane supervisor / lift supervisor</label>
        <input style={ss.inp} value={form.liftSupervisor} onChange={(e) => set("liftSupervisor", e.target.value)}  id="lifting-plan-lift-supervisor" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-slinger-signaller">Slinger / signaller</label>
        <input style={ss.inp} value={form.slingerSignaller} onChange={(e) => set("slingerSignaller", e.target.value)}  id="lifting-plan-slinger-signaller" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-method-statement-ref">RAMS / method statement ref</label>
        <input style={ss.inp} value={form.methodStatementRef} onChange={(e) => set("methodStatementRef", e.target.value)}  id="lifting-plan-method-statement-ref" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.briefingDone} onChange={(e) => set("briefingDone", e.target.checked)} />
          Pre-lift briefing completed
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lifting-plan-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 44, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="lifting-plan-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["liftRef","liftDate"], { liftRef: "Lift ref", liftDate: "Lift date" });
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

export default function LiftingPlanRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("lifting_plan_register", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "lifting_plan_register",
    namespace: "lifting_plan_register",
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
    const h = ["Ref", "Date", "Load", "Plant", "Project", "AP", "Supervisor", "Briefing", "RAMS ref"];
    const rows = liveItems.map((r) => [r.liftRef, r.liftDate, r.loadDescription, r.craneOrLift, r.projectName || "", r.appointedPerson, r.liftSupervisor, r.briefingDone ? "yes" : "no", r.methodStatementRef]);
    exportCsv(h, rows, `lifting_operations_${today()}.csv`);
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
    pushAudit({ action: isNew ? "lifting_create" : "lifting_update", entity: "lifting", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="lifting operations" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="lifting"
        badgeText="LIFT"
        title="Lifting operations"
        lead="Lift plans, equipment, and briefings (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add lift
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="lifting"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("lifting", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🏗️"
          title="No lifting records"
          description="Record lift plans, equipment and briefings before operations."
          actionLabel="+ Add lift"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.liftRef || "Lift"}</strong> · {r.liftDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.loadDescription?.slice(0, 90) || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="lifting" record={r} />
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
                            moduleId: "lifting",
                            moduleLabel: "Lifting operations",
                            itemType: "lifting_plan",
                            itemLabel: r.liftRef || r.liftDate || r.id,
                            sourceKey: "lifting_plan_register",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "lifting_delete", entity: "lifting", detail: r.id });
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
