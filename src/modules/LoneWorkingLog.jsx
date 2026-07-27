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
const genId = () => `lw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        workerName: "",
        task: "",
        location: "",
        projectId: "",
        workDate: today(),
        startTime: "08:00",
        expectedEnd: "17:00",
        contactNumber: "",
        signedOff: false,
        signedOffAt: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 540 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit lone working" : "Lone working record"}</h2>
        <label style={ss.lbl} htmlFor="lone-working-worker-name">Person</label>
        <input style={ss.inp} value={form.workerName} onChange={(e) => set("workerName", e.target.value)}  id="lone-working-worker-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lone-working-task">Task</label>
        <input style={ss.inp} value={form.task} onChange={(e) => set("task", e.target.value)}  id="lone-working-task" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lone-working-location">Location</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)}  id="lone-working-location" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lone-working-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="lone-working-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lone-working-work-date">Date</label>
        <input type="date" style={ss.inp} value={form.workDate} onChange={(e) => set("workDate", e.target.value)}  id="lone-working-work-date" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="lone-working-start-time">Start</label>
            <input type="time" style={ss.inp} value={form.startTime} onChange={(e) => set("startTime", e.target.value)}  id="lone-working-start-time" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="lone-working-expected-end">Expected finish</label>
            <input type="time" style={ss.inp} value={form.expectedEnd} onChange={(e) => set("expectedEnd", e.target.value)}  id="lone-working-expected-end" />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lone-working-contact-number">Check-in contact number</label>
        <input style={ss.inp} inputMode="tel" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)}  id="lone-working-contact-number" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.signedOff} onChange={(e) => set("signedOff", e.target.checked)} />
          Signed off / task completed safely
        </label>
        {form.signedOff && (
          <>
            <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lone-working-signed-off-at">Signed off at (optional)</label>
            <input type="datetime-local" style={ss.inp} value={form.signedOffAt || ""} onChange={(e) => set("signedOffAt", e.target.value)}  id="lone-working-signed-off-at" />
          </>
        )}
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="lone-working-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="lone-working-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["workerName","workDate"], { workerName: "Worker name", workDate: "Work date" });
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

export default function LoneWorkingLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("lone_working_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "lone_working_log",
    namespace: "lone_working_log",
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
    const h = ["Date", "Person", "Task", "Location", "Project", "Start", "End", "Contact", "Signed off", "Notes"];
    const rows = liveItems.map((r) => [r.workDate, r.workerName, r.task, r.location, r.projectName || "", r.startTime, r.expectedEnd, r.contactNumber, r.signedOff ? "yes" : "no", r.notes]);
    exportCsv(h, rows, `lone_working_${today()}.csv`);
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
    pushAudit({ action: isNew ? "lone_working_create" : "lone_working_update", entity: "lone_working", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="lone working log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="lone-working"
        badgeText="LW"
        title="Lone working"
        lead="Check-ins and lone worker welfare records (local only)."
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
        moduleId="lone-working"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("lone-working", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="📡"
          title="No lone working records"
          description="Record check-ins and lone worker welfare details."
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
                  <strong>{r.workerName}</strong> · {r.workDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.task} · {r.location}</div>
                  {!r.signedOff && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Not signed off</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="lone-working" record={r} />
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
                            moduleId: "lone-working",
                            moduleLabel: "Lone working",
                            itemType: "lone_working",
                            itemLabel: r.workerName || r.workDate || r.id,
                            sourceKey: "lone_working_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "lone_working_delete", entity: "lone_working", detail: r.id });
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
