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
const genId = () => `lad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        ladderRef: "",
        type: "Extension",
        location: "",
        projectId: "",
        inspectionDate: today(),
        nextDue: "",
        result: "pass",
        inspector: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit ladder check" : "Ladder inspection"}</h2>
        <label style={ss.lbl} htmlFor="ladder-inspection-ladder-ref">Ladder ID / tag</label>
        <input style={ss.inp} value={form.ladderRef} onChange={(e) => set("ladderRef", e.target.value)}  id="ladder-inspection-ladder-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ladder-inspection-type">Type</label>
        <select style={ss.inp} value={form.type} onChange={(e) => set("type", e.target.value)} id="ladder-inspection-type">
          <option value="Extension">Extension</option>
          <option value="Step">Step</option>
          <option value="Platform">Platform / podium</option>
          <option value="Other">Other</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ladder-inspection-location">Location / stored</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)}  id="ladder-inspection-location" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ladder-inspection-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="ladder-inspection-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="ladder-inspection-inspection-date">Inspection date</label>
            <input type="date" style={ss.inp} value={form.inspectionDate} onChange={(e) => set("inspectionDate", e.target.value)}  id="ladder-inspection-inspection-date" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="ladder-inspection-next-due">Next due</label>
            <input type="date" style={ss.inp} value={form.nextDue || ""} onChange={(e) => set("nextDue", e.target.value)}  id="ladder-inspection-next-due" />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ladder-inspection-result">Result</label>
        <select style={ss.inp} value={form.result} onChange={(e) => set("result", e.target.value)} id="ladder-inspection-result">
          <option value="pass">Satisfactory</option>
          <option value="repair">Repair before use</option>
          <option value="withdrawn">Withdrawn / scrap</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ladder-inspection-inspector">Inspector</label>
        <input style={ss.inp} value={form.inspector} onChange={(e) => set("inspector", e.target.value)}  id="ladder-inspection-inspector" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ladder-inspection-notes">Notes / defects</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="ladder-inspection-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["ladderRef","inspectionDate"], { ladderRef: "Ladder ref", inspectionDate: "Inspection date" });
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

export default function LadderInspection() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("ladder_inspections", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "ladder_inspections",
    namespace: "ladder_inspections",
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
    const h = ["Ladder ref", "Type", "Location", "Project", "Date", "Next due", "Result", "Inspector"];
    const rows = liveItems.map((r) => [r.ladderRef, r.type, r.location, r.projectName || "", r.inspectionDate, r.nextDue, r.result, r.inspector]);
    exportCsv(h, rows, `ladder_inspections_${today()}.csv`);
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
    pushAudit({ action: isNew ? "ladder_create" : "ladder_update", entity: "ladder", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="ladder inspections" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="ladders"
        badgeText="LD"
        title="Ladder inspections"
        lead="Pre-use and formal ladder inspection records (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add inspection
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="ladders"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("ladders", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🪜"
          title="No ladder inspections yet"
          description="Record pre-use and formal ladder checks so defective kit is taken out of service."
          actionLabel="+ Add inspection"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.ladderRef || "No ref"}</strong> · {r.type} · {r.inspectionDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.location} · {r.result}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="ladders" record={r} />
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
                            moduleId: "ladders",
                            moduleLabel: "Ladder inspections",
                            itemType: "ladder_inspection",
                            itemLabel: r.ladderRef || r.location || r.id,
                            sourceKey: "ladder_inspections",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "ladder_delete", entity: "ladder", detail: r.id });
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
