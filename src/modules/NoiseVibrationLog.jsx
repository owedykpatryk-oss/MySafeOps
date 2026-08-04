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
const genId = () => `nv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        recordType: "noise",
        activityOrTool: "",
        location: "",
        projectId: "",
        logDate: today(),
        durationMinutes: "",
        laeqOrReading: "",
        hearingProtection: true,
        havTriggerTime: "",
        assessedBy: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit record" : "Noise / vibration"}</h2>
        <label style={ss.lbl} htmlFor="noise-vibration-record-type">Type</label>
        <select style={ss.inp} value={form.recordType} onChange={(e) => set("recordType", e.target.value)} id="noise-vibration-record-type">
          <option value="noise">Noise exposure / monitoring</option>
          <option value="hav">Hand-arm vibration (tool time)</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-activity-or-tool">Activity / equipment</label>
        <input style={ss.inp} value={form.activityOrTool} onChange={(e) => set("activityOrTool", e.target.value)}  id="noise-vibration-activity-or-tool" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-location">Location</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)}  id="noise-vibration-location" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="noise-vibration-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-log-date">Date</label>
        <input type="date" style={ss.inp} value={form.logDate} onChange={(e) => set("logDate", e.target.value)}  id="noise-vibration-log-date" />
        {form.recordType === "noise" ? (
          <>
            <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-duration-minutes">Duration (minutes)</label>
            <input style={ss.inp} inputMode="numeric" value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)}  id="noise-vibration-duration-minutes" />
            <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-laeq-or-reading">LAeq / reading note (optional)</label>
            <input style={ss.inp} value={form.laeqOrReading} onChange={(e) => set("laeqOrReading", e.target.value)}  id="noise-vibration-laeq-or-reading" />
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
              <input type="checkbox" checked={form.hearingProtection} onChange={(e) => set("hearingProtection", e.target.checked)} />
              Hearing protection used / required
            </label>
          </>
        ) : (
          <>
            <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-hav-trigger-time">Trigger time (minutes)</label>
            <input style={ss.inp} inputMode="numeric" value={form.havTriggerTime} onChange={(e) => set("havTriggerTime", e.target.value)}  id="noise-vibration-hav-trigger-time" />
          </>
        )}
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-assessed-by">Recorded by</label>
        <input style={ss.inp} value={form.assessedBy} onChange={(e) => set("assessedBy", e.target.value)}  id="noise-vibration-assessed-by" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="noise-vibration-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 44, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="noise-vibration-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["activityOrTool","logDate"], { activityOrTool: "Activity / equipment", logDate: "Date" });
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

export default function NoiseVibrationLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("noise_vibration_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "noise_vibration_log",
    namespace: "noise_vibration_log",
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
    const h = ["Type", "Date", "Activity", "Location", "Project", "Detail", "By"];
    const rows = liveItems.map((r) => [
      r.recordType,
      r.logDate,
      r.activityOrTool,
      r.location,
      r.projectName || "",
      r.recordType === "noise" ? `${r.durationMinutes} min` : `${r.havTriggerTime} min HAV`,
      r.assessedBy,
    ]);
    exportCsv(h, rows, `noise_vibration_${today()}.csv`);
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
    pushAudit({ action: isNew ? "noise_vib_create" : "noise_vib_update", entity: "noise", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="noise & vibration log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="noise"
        badgeText="NV"
        title="Noise & vibration"
        lead="Noise and HAV exposure records (local only)."
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
        moduleId="noise"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("noise", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🔊"
          title="No noise or vibration records yet"
          description="Log noise exposure and HAV trigger times for tools and plant."
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
                  <strong>{r.recordType === "noise" ? "Noise" : "HAV"}</strong> · {r.logDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.activityOrTool} · {r.location}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="noise" record={r} />
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
                            moduleId: "noise",
                            moduleLabel: "Noise & vibration",
                            itemType: "noise_vibration",
                            itemLabel: `${r.recordType === "noise" ? "Noise" : "HAV"} — ${r.logDate || r.id}`,
                            sourceKey: "noise_vibration_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "noise_vib_delete", entity: "noise", detail: r.id });
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
