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
const genId = () => `welf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        checkDate: today(),
        projectId: "",
        toiletsOk: true,
        handWashOk: true,
        drinkingWaterOk: true,
        dryingRoomOk: true,
        restShelterOk: true,
        changingOk: true,
        checkedBy: "",
        issues: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 480 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit welfare check" : "Welfare check"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>CDM 2015 Schedule 2 / site rules — tick what applies to your setup.</p>
        <label style={ss.lbl} htmlFor="welfare-check-check-date">Date</label>
        <input type="date" style={ss.inp} value={form.checkDate} onChange={(e) => set("checkDate", e.target.value)}  id="welfare-check-check-date" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="welfare-check-project-id">Project / site</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="welfare-check-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 14 }}>Facilities</label>
        {[
          ["toiletsOk", "Toilets adequate & serviced"],
          ["handWashOk", "Hand washing (hot/cold or gel)"],
          ["drinkingWaterOk", "Drinking water"],
          ["dryingRoomOk", "Drying room / lockers (if required)"],
          ["restShelterOk", "Rest / mess shelter"],
          ["changingOk", "Changing / PPE storage"],
        ].map(([key, label]) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
            {label}
          </label>
        ))}
        <label style={{ ...ss.lbl, marginTop: 12 }} htmlFor="welfare-check-checked-by">Checked by</label>
        <input style={ss.inp} value={form.checkedBy} onChange={(e) => set("checkedBy", e.target.value)}  id="welfare-check-checked-by" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="welfare-check-issues">Issues / actions</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.issues} onChange={(e) => set("issues", e.target.value)}  id="welfare-check-issues" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["checkedBy","checkDate"], { checkedBy: "Checked by", checkDate: "Check date" });
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

export default function WelfareCheckLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("welfare_check_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1WelfH, d1OutboxPending: d1WelfO } = useD1OrgArraySync({
    storageKey: "welfare_check_log",
    namespace: "welfare_check_log",
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
  const d1Hydrating = d1WelfH || d1ProjH;
  const d1OutboxPending = d1WelfO || d1ProjO;

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Date", "Project", "Toilets", "Wash", "Water", "Drying", "Rest", "Changing", "By", "Issues"];
    const rows = liveItems.map((r) => [
      r.checkDate,
      r.projectName || "",
      r.toiletsOk ? "Y" : "N",
      r.handWashOk ? "Y" : "N",
      r.drinkingWaterOk ? "Y" : "N",
      r.dryingRoomOk ? "Y" : "N",
      r.restShelterOk ? "Y" : "N",
      r.changingOk ? "Y" : "N",
      r.checkedBy,
      r.issues,
    ]);
    exportCsv(h, rows, `welfare_checks_${today()}.csv`);
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
    pushAudit({ action: isNew ? "welfare_create" : "welfare_update", entity: "welfare", detail: f.id });
    setModal(null);
  };

  const anyFail = (r) => !r.toiletsOk || !r.handWashOk || !r.drinkingWaterOk;

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="welfare checks" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="welfare"
        badgeText="WF"
        title="Welfare checks"
        lead="Toilets, rest, water, drying — welfare monitoring (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add check
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="welfare"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("welfare", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🚻"
          title="No welfare checks yet"
          description="Record toilets, wash facilities, water and rest areas on site."
          actionLabel="+ Add check"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.checkDate}</strong> · {r.projectName || "Site"}
                  {anyFail(r) && <span style={{ marginLeft: 8, fontSize: 11, color: "#A32D2D" }}>Review items</span>}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.checkedBy}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="welfare" record={r} />
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
                            moduleId: "welfare",
                            moduleLabel: "Welfare checks",
                            itemType: "welfare_check",
                            itemLabel: r.checkDate || r.projectName || r.id,
                            sourceKey: "welfare_check_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "welfare_delete", entity: "welfare", detail: r.id });
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
