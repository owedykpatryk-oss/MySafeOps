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
const genId = () => `cs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        permitRef: "",
        spaceDescription: "",
        projectId: "",
        entryDate: today(),
        timeStart: "08:00",
        timeEnd: "",
        entrants: "",
        topMan: "",
        gasTestOk: false,
        rescuePlanRef: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 540 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit confined space entry" : "Confined space entry"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Record only — follow permit-to-work, rescue plan, and competent gas testing.</p>
        <label style={ss.lbl} htmlFor="confined-space-permit-ref">Permit / work package ref</label>
        <input style={ss.inp} value={form.permitRef} onChange={(e) => set("permitRef", e.target.value)}  id="confined-space-permit-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="confined-space-space-description">Space / task description</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.spaceDescription} onChange={(e) => set("spaceDescription", e.target.value)}  id="confined-space-space-description" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="confined-space-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="confined-space-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="confined-space-entry-date">Date</label>
        <input type="date" style={ss.inp} value={form.entryDate} onChange={(e) => set("entryDate", e.target.value)}  id="confined-space-entry-date" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="confined-space-time-start">Start</label>
            <input type="time" style={ss.inp} value={form.timeStart} onChange={(e) => set("timeStart", e.target.value)}  id="confined-space-time-start" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="confined-space-time-end">End</label>
            <input type="time" style={ss.inp} value={form.timeEnd || ""} onChange={(e) => set("timeEnd", e.target.value)}  id="confined-space-time-end" />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="confined-space-entrants">Entrants (names)</label>
        <input style={ss.inp} value={form.entrants} onChange={(e) => set("entrants", e.target.value)}  id="confined-space-entrants" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="confined-space-top-man">Stand-by / top man</label>
        <input style={ss.inp} value={form.topMan} onChange={(e) => set("topMan", e.target.value)}  id="confined-space-top-man" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.gasTestOk} onChange={(e) => set("gasTestOk", e.target.checked)} />
          Gas / atmosphere test satisfactory before entry
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="confined-space-rescue-plan-ref">Rescue plan ref</label>
        <input style={ss.inp} value={form.rescuePlanRef} onChange={(e) => set("rescuePlanRef", e.target.value)}  id="confined-space-rescue-plan-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="confined-space-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 44, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="confined-space-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["spaceDescription","entryDate"], { spaceDescription: "Space description", entryDate: "Entry date" });
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

export default function ConfinedSpaceLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("confined_space_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "confined_space_log",
    namespace: "confined_space_log",
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
    const h = ["Date", "Permit", "Space", "Project", "Start", "End", "Entrants", "Stand-by", "Gas OK", "Rescue ref"];
    const rows = liveItems.map((r) => [r.entryDate, r.permitRef, r.spaceDescription, r.projectName || "", r.timeStart, r.timeEnd, r.entrants, r.topMan, r.gasTestOk ? "yes" : "no", r.rescuePlanRef]);
    exportCsv(h, rows, `confined_space_${today()}.csv`);
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
    pushAudit({ action: isNew ? "confined_space_create" : "confined_space_update", entity: "confined_space", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="confined space log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="confined-space"
        badgeText="CS"
        title="Confined space log"
        lead="Entries, gas checks, and standby — export the register to PDF from the header."
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
        moduleId="confined-space"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("confined-space", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🕳️"
          title="No confined space entries"
          description="Log entries, gas checks and standby arrangements."
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
                  <strong>{r.permitRef || "Entry"}</strong> · {r.entryDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.spaceDescription?.slice(0, 100) || "—"}</div>
                  {!r.gasTestOk && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Gas test not ticked OK</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="confined-space" record={r} />
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
                            moduleId: "confined-space",
                            moduleLabel: "Confined space log",
                            itemType: "confined_space_entry",
                            itemLabel: r.permitRef || r.entryDate || r.id,
                            sourceKey: "confined_space_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "confined_space_delete", entity: "confined_space", detail: r.id });
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
