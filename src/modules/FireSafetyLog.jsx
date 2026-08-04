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
const genId = () => `fire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

const TYPES = ["Fire extinguisher", "Fire alarm test", "Emergency lighting", "Assembly point signage", "Fire door", "Other"];

function Form({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        checkType: "Fire extinguisher",
        location: "",
        checkDate: today(),
        satisfactory: true,
        checkedBy: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 500 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit fire check" : "Fire safety check"}</h2>
        <label style={ss.lbl} htmlFor="fire-safety-check-type">Check type</label>
        <select style={ss.inp} value={form.checkType} onChange={(e) => set("checkType", e.target.value)} id="fire-safety-check-type">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="fire-safety-location">Location</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)}  id="fire-safety-location" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="fire-safety-check-date">Date</label>
        <input type="date" style={ss.inp} value={form.checkDate} onChange={(e) => set("checkDate", e.target.value)}  id="fire-safety-check-date" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.satisfactory} onChange={(e) => set("satisfactory", e.target.checked)} />
          Satisfactory
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="fire-safety-checked-by">Checked by</label>
        <input style={ss.inp} value={form.checkedBy} onChange={(e) => set("checkedBy", e.target.value)}  id="fire-safety-checked-by" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="fire-safety-notes">Notes / actions</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="fire-safety-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const check = validateRequiredFields(form, ["location","checkDate"], { location: "Location", checkDate: "Check date" });
            if (!check.ok) { window.alert(check.message); return; }
            onSave(form);
          }}>
            Save
          </button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

export default function FireSafetyLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("fire_safety_log", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);
  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: "fire_safety_log",
    namespace: "fire_safety_log",
    value: items,
    setValue: setItems,
    load,
    save,
  });

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Date", "Type", "Location", "OK", "Checked by", "Notes"];
    const rows = liveItems.map((r) => [r.checkDate, r.checkType, r.location, r.satisfactory ? "yes" : "no", r.checkedBy, r.notes]);
    exportCsv(h, rows, `fire_safety_${today()}.csv`);
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
    pushAudit({ action: isNew ? "fire_check_create" : "fire_check_update", entity: "fire", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="fire"
        badgeText="FIRE"
        title="Fire safety log"
        lead="Drills, extinguishers, alarms, and fire marshal records — synced to your org cloud when D1 is enabled."
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

      <D1ModuleSyncBanner hydrating={d1Hydrating} outboxPending={d1OutboxPending} />

      <RegisterModuleShell
        moduleId="fire"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("fire", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🔥"
          title="No fire checks recorded"
          description="Log extinguisher, alarm and emergency lighting checks."
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
                  <strong>{r.checkType}</strong> · {r.checkDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.location} · {r.satisfactory ? "OK" : "Action required"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="fire" record={r} />
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
                            moduleId: "fire",
                            moduleLabel: "Fire safety log",
                            itemType: "fire_check",
                            itemLabel: `${r.checkType || "Check"} — ${r.location || r.checkDate || r.id}`,
                            sourceKey: "fire_safety_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "fire_check_delete", entity: "fire", detail: r.id });
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
