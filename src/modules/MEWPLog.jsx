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
import { useWorkspaceT } from "../i18n/useWorkspaceT";

import { todayLocalISO } from "../utils/localDate";
const genId = () => `mewp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const { t } = useWorkspaceT();
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        equipmentRef: "",
        mewpType: "",
        operatorName: "",
        licenceRef: "",
        checkDate: today(),
        projectId: "",
        preUseOk: true,
        groundConditionsOk: true,
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit MEWP check" : "MEWP pre-use check"}</h2>
        <label style={ss.lbl} htmlFor="mewp-equipment-ref">Equipment ref / plant no.</label>
        <input style={ss.inp} value={form.equipmentRef} onChange={(e) => set("equipmentRef", e.target.value)}  id="mewp-equipment-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="mewp-type">Type (scissor / boom / etc.)</label>
        <input style={ss.inp} value={form.mewpType} onChange={(e) => set("mewpType", e.target.value)}  id="mewp-type" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="mewp-operator-name">Operator</label>
        <input style={ss.inp} value={form.operatorName} onChange={(e) => set("operatorName", e.target.value)}  id="mewp-operator-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="mewp-licence-ref">Licence / IPAF card ref</label>
        <input style={ss.inp} value={form.licenceRef} onChange={(e) => set("licenceRef", e.target.value)}  id="mewp-licence-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="mewp-check-date">{t("date")}</label>
        <input type="date" style={ss.inp} value={form.checkDate} onChange={(e) => set("checkDate", e.target.value)}  id="mewp-check-date" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="mewp-project-id">{t("project")}</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="mewp-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.preUseOk} onChange={(e) => set("preUseOk", e.target.checked)} />
          Pre-use checks satisfactory
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={form.groundConditionsOk} onChange={(e) => set("groundConditionsOk", e.target.checked)} />
          Ground conditions / exclusion zone OK
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="mewp-notes">{t("notes")}</label>
        <textarea style={{ ...ss.inp, minHeight: 44, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="mewp-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["equipmentRef","checkDate"], { equipmentRef: "Equipment ref", checkDate: "Check date" });
            if (!check.ok) { window.alert(check.message); return; }
            onSave(payload);
          }}>
            {t("save")}
          </button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

export default function MEWPLog() {
  const { t } = useWorkspaceT();
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("mewp_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "mewp_log",
    namespace: "mewp_log",
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
    const h = ["Equipment", "Type", "Operator", "Licence", "Date", "Project", "Pre-use OK", "Ground OK"];
    const rows = liveItems.map((r) => [r.equipmentRef, r.mewpType, r.operatorName, r.licenceRef, r.checkDate, r.projectName || "", r.preUseOk ? "Y" : "N", r.groundConditionsOk ? "Y" : "N"]);
    exportCsv(h, rows, `mewp_log_${today()}.csv`);
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
    pushAudit({ action: isNew ? "mewp_create" : "mewp_update", entity: "mewp", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="MEWP log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="mewp"
        badgeText="MEWP"
        title="MEWP log"
        lead="Mobile elevating work platform pre-use checks (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              {t("exportCsv")}
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            {t("addRecord")}
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="mewp"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("mewp", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🏗️"
          title="No MEWP checks recorded"
          description="Record pre-use checks for scissor lifts and boom lifts."
          actionLabel={t("addRecord")}
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.equipmentRef || "MEWP"}</strong> · {r.checkDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.mewpType} · {r.operatorName}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="mewp" record={r} />
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    {t("edit")}
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (
                          softDeleteToRecycleBin({
                            moduleId: "mewp",
                            moduleLabel: "MEWP log",
                            itemType: "mewp_check",
                            itemLabel: r.equipmentRef || r.checkDate || r.id,
                            sourceKey: "mewp_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "mewp_delete", entity: "mewp", detail: r.id });
                        }
                      }}
                    >
                      {t("delete")}
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
