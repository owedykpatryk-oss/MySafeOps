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
const genId = () => `ppe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

const PPE_ITEMS = ["Hard hat", "Safety boots", "Hi-vis", "Gloves", "Eye protection", "Hearing protection", "Harness / lanyard", "Respiratory", "Other"];

function Form({ item, workers, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        workerId: "",
        workerName: "",
        item: "Hard hat",
        issuedDate: today(),
        conditionOk: true,
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const wm = Object.fromEntries(workers.map((w) => [w.id, w.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit PPE record" : "Issue / check PPE"}</h2>
        <label style={ss.lbl} htmlFor="ppe-worker-id">Worker</label>
        <select style={ss.inp} value={form.workerId} onChange={(e) => set("workerId", e.target.value)} id="ppe-worker-id">
          <option value="">—</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ppe-item">PPE item</label>
        <select style={ss.inp} value={form.item} onChange={(e) => set("item", e.target.value)} id="ppe-item">
          {PPE_ITEMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ppe-issued-date">Date</label>
        <input type="date" style={ss.inp} value={form.issuedDate} onChange={(e) => set("issuedDate", e.target.value)}  id="ppe-issued-date" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.conditionOk} onChange={(e) => set("conditionOk", e.target.checked)} />
          Condition acceptable / fit for use
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="ppe-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="ppe-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, workerName: wm[form.workerId] || form.workerName || "" };
            const check = validateRequiredFields(payload, ["workerId","issuedDate"], { workerId: "Worker", issuedDate: "Date" });
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

export default function PPERegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("ppe_register", []));
  const [workers, setWorkers] = useState(() => load("mysafeops_workers", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "ppe_register",
    namespace: "ppe_register",
    value: items,
    setValue: setItems,
    load,
    save,
  });
  const { d1Hydrating: d1WorkersH, d1OutboxPending: d1WorkersO } = useD1OrgArraySync({
    storageKey: "mysafeops_workers",
    namespace: "mysafeops_workers",
    value: workers,
    setValue: setWorkers,
    load,
    save,
  });
  const d1Hydrating = d1ItemsH || d1WorkersH;
  const d1OutboxPending = d1ItemsO || d1WorkersO;

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Date", "Worker", "Item", "OK", "Notes"];
    const rows = liveItems.map((r) => [r.issuedDate, r.workerName, r.item, r.conditionOk ? "yes" : "no", r.notes]);
    exportCsv(h, rows, `ppe_register_${today()}.csv`);
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
    pushAudit({ action: isNew ? "ppe_create" : "ppe_update", entity: "ppe", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="PPE register" />
      {modal?.type === "form" && <Form item={modal.data} workers={workers} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="ppe"
        badgeText="PPE"
        title="PPE register"
        lead="Issue checks and condition records (local only)."
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
        moduleId="ppe"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("ppe", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🦺"
          title="No PPE records yet"
          description="Log issue of hard hats, boots, harnesses and other PPE to each person."
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
                  <strong>{r.item}</strong> · {r.issuedDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.workerName || "—"} · {r.conditionOk ? "OK" : "Issue noted"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="ppe" record={r} />
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
                            moduleId: "ppe",
                            moduleLabel: "PPE register",
                            itemType: "ppe_issue",
                            itemLabel: `${r.workerName || "Worker"} — ${r.item || "PPE"}`,
                            sourceKey: "ppe_register",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "ppe_delete", entity: "ppe", detail: r.id });
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
