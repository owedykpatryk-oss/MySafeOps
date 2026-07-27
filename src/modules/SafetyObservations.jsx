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
const genId = () => `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        polarity: "positive",
        obsDate: today(),
        projectId: "",
        location: "",
        detail: "",
        observer: "",
        actionTaken: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit observation" : "Safety observation"}</h2>
        <label style={ss.lbl} htmlFor="safety-observations-polarity">Type</label>
        <select style={ss.inp} value={form.polarity} onChange={(e) => set("polarity", e.target.value)} id="safety-observations-polarity">
          <option value="positive">Positive (good practice)</option>
          <option value="at_risk">At-risk behaviour / condition</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="safety-observations-obs-date">Date</label>
        <input type="date" style={ss.inp} value={form.obsDate} onChange={(e) => set("obsDate", e.target.value)}  id="safety-observations-obs-date" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="safety-observations-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="safety-observations-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="safety-observations-location">Location / activity</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)}  id="safety-observations-location" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="safety-observations-detail">What was observed</label>
        <textarea style={{ ...ss.inp, minHeight: 72, resize: "vertical" }} value={form.detail} onChange={(e) => set("detail", e.target.value)}  id="safety-observations-detail" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="safety-observations-observer">Observer</label>
        <input style={ss.inp} value={form.observer} onChange={(e) => set("observer", e.target.value)}  id="safety-observations-observer" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="safety-observations-action-taken">Discussion / action (optional)</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.actionTaken} onChange={(e) => set("actionTaken", e.target.value)}  id="safety-observations-action-taken" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["detail","obsDate"], { detail: "Observation detail", obsDate: "Date" });
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

export default function SafetyObservations() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("safety_observations", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "safety_observations",
    namespace: "safety_observations",
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
    const h = ["Date", "Type", "Project", "Location", "Detail", "Observer", "Action"];
    const rows = liveItems.map((r) => [r.obsDate, r.polarity === "positive" ? "positive" : "at_risk", r.projectName || "", r.location, r.detail, r.observer, r.actionTaken]);
    exportCsv(h, rows, `safety_observations_${today()}.csv`);
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
    pushAudit({ action: isNew ? "observation_create" : "observation_update", entity: "observation", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="safety observations" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="observations"
        badgeText="OBS"
        title="Safety observations"
        lead="Positive interventions and unsafe act observations (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add observation
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="observations"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("observations", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="👁️"
          title="No observations yet"
          description="Capture positive behaviours and at-risk findings from site walks."
          actionLabel="+ Add observation"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div
              key={r.id}
              style={{
                ...ss.card,
                borderLeft: `4px solid ${r.polarity === "positive" ? "#0d9488" : "#ea580c"}`,
                contentVisibility: "auto",
                containIntrinsicSize: "0 96px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.polarity === "positive" ? "Positive" : "At risk"}</strong> · {r.obsDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.location}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>{r.detail}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="observations" record={r} />
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
                            moduleId: "observations",
                            moduleLabel: "Safety observations",
                            itemType: "observation",
                            itemLabel: String(r.detail || r.location || r.id).slice(0, 80),
                            sourceKey: "safety_observations",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "observation_delete", entity: "observation", detail: r.id });
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
