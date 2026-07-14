import { useMemo, useState, useCallback } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import PageHero from "../components/PageHero";
import RegisterModuleShell from "../components/RegisterModuleShell";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { getWorkerCertAlerts } from "../utils/certifications";
import { getEquipmentDueAlerts } from "../utils/equipmentInspectionDue";
import { getVehicleDueAlerts } from "../utils/vehicleComplianceDue";
import { buildPeopleNextSteps } from "../utils/peopleNextSteps";
import PeopleNextSteps from "../components/PeopleNextSteps";
import { openWorkspaceView } from "../utils/workspaceNavContext";
import { getOrgId } from "../utils/orgStorage";
import { useToast } from "../context/ToastContext";
import { getOrgMarketId } from "../utils/orgMarket";
import { syncAllTrainingToWorkers, syncTrainingRecordToWorkers } from "../utils/trainingWorkerCertSync";

const genId = () => `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

function Form({ item, workers, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        workerId: "",
        workerName: "",
        courseName: "",
        provider: "",
        completedDate: today(),
        expiryDate: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const [syncToPeople, setSyncToPeople] = useState(Boolean(item?.workerId && item?.expiryDate));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const wm = Object.fromEntries(workers.map((w) => [w.id, w.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit training" : "Training record"}</h2>
        <label style={ss.lbl}>Worker</label>
        <select style={ss.inp} value={form.workerId} onChange={(e) => set("workerId", e.target.value)}>
          <option value="">—</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Course / qualification</label>
        <input style={ss.inp} value={form.courseName} onChange={(e) => set("courseName", e.target.value)} placeholder="e.g. CSCS, IPAF, asbestos awareness" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Provider</label>
        <input style={ss.inp} value={form.provider} onChange={(e) => set("provider", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Completed</label>
            <input type="date" style={ss.inp} value={form.completedDate} onChange={(e) => set("completedDate", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Expiry (optional)</label>
            <input type="date" style={ss.inp} value={form.expiryDate || ""} onChange={(e) => set("expiryDate", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        {form.workerId && form.expiryDate ? (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, fontSize: 13 }}>
            <input type="checkbox" checked={syncToPeople} onChange={(e) => setSyncToPeople(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              Update certificate in <strong>People</strong> on save
              <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                Matches course name to CSCS, IPAF, etc. and sets expiry on the worker record.
              </span>
            </span>
          </label>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={ss.btnP}
            onClick={() => onSave({ ...form, workerName: wm[form.workerId] || form.workerName || "" }, { syncToPeople })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingMatrix() {
  const { caps } = useApp();
  const { pushToast } = useToast();
  const marketId = getOrgMarketId();
  const [items, setItems] = useState(() => load("training_matrix", []));
  const [workers, setWorkers] = useState(() => load("mysafeops_workers", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1TrainH, d1OutboxPending: d1TrainO } = useD1OrgArraySync({
    storageKey: "training_matrix",
    namespace: "training_matrix",
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
  const d1Hydrating = d1TrainH || d1WorkersH;
  const d1OutboxPending = d1TrainO || d1WorkersO;

  const expiring = useMemo(() => items.filter((r) => r.expiryDate && daysUntil(r.expiryDate) <= 60 && daysUntil(r.expiryDate) >= 0), [items]);
  const expired = useMemo(() => items.filter((r) => r.expiryDate && daysUntil(r.expiryDate) < 0), [items]);
  const certAlerts = useMemo(
    () => workers.flatMap((w) => getWorkerCertAlerts(w).map((a) => ({ ...a, worker: w }))),
    [workers]
  );
  const equipmentAlerts = getEquipmentDueAlerts();
  const vehicleAlerts = getVehicleDueAlerts();
  const [stepsHidden, setStepsHidden] = useState(() => {
    try {
      return sessionStorage.getItem(`training_next_steps_hide_${getOrgId()}`) === "1";
    } catch {
      return false;
    }
  });
  const nextSteps = useMemo(
    () =>
      buildPeopleNextSteps({
        workers,
        certAlerts,
        equipmentAlerts,
        vehicleAlerts,
        trainingRecords: items,
        projects: [],
      }),
    [workers, certAlerts, equipmentAlerts, vehicleAlerts, items]
  );
  const runNextStepAction = useCallback((action) => {
    try {
      sessionStorage.removeItem(`training_next_steps_hide_${getOrgId()}`);
    } catch {
      /* ignore */
    }
    setStepsHidden(false);
    switch (action) {
      case "add_worker":
      case "scroll_people":
      case "scroll_certs":
        openWorkspaceView({ viewId: "people" });
        break;
      case "open_training":
        document.getElementById("training-register")?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "open_inspections":
        openWorkspaceView({ viewId: "inspections" });
        break;
      case "open_plant":
        openWorkspaceView({ viewId: "plant" });
        break;
      case "open_vehicles":
        openWorkspaceView({ viewId: "vehicles" });
        break;
      default:
        break;
    }
  }, []);
  const hideNextSteps = useCallback(() => {
    setStepsHidden(true);
    try {
      sessionStorage.setItem(`training_next_steps_hide_${getOrgId()}`, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const syncableCount = useMemo(
    () => items.filter((r) => r.workerId && r.expiryDate).length,
    [items]
  );

  const syncRecordToPeople = useCallback(
    (record, { quiet = false } = {}) => {
      const out = syncTrainingRecordToWorkers(workers, record, marketId);
      if (!out.ok) {
        if (!quiet) {
          pushToast(
            out.reason === "missing_worker"
              ? "Link a worker before syncing to People."
              : out.reason === "missing_expiry"
                ? "Add an expiry date before syncing to People."
                : "Could not sync this record to People.",
            "warn"
          );
        }
        return false;
      }
      setWorkers(out.workers);
      pushAudit({ action: "training_sync_cert", entity: "training", detail: `${record.id}:${out.certType}` });
      if (!quiet) {
        pushToast(`Updated ${out.certType} on ${record.workerName || "worker"} in People.`, "success");
      }
      return true;
    },
    [workers, marketId, pushToast]
  );

  const syncAllToPeople = useCallback(() => {
    const eligible = items.filter((r) => r.workerId && r.expiryDate);
    const out = syncAllTrainingToWorkers(workers, eligible, marketId);
    if (out.synced === 0) {
      pushToast("No training records with worker and expiry to sync.", "info");
      return;
    }
    setWorkers(out.workers);
    pushAudit({ action: "training_sync_cert_bulk", entity: "training", detail: String(out.synced) });
    pushToast(`Synced ${out.synced} training record(s) to People certificates.`, "success");
  }, [items, workers, marketId, pushToast]);

  const exportCsv = () => {
    const h = ["Worker", "Course", "Provider", "Completed", "Expiry", "Notes"];
    const rows = items.map((r) => [r.workerName, r.courseName, r.provider, r.completedDate, r.expiryDate || "", r.notes]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `training_matrix_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const persist = (f, isNew, opts = {}) => {
    setItems((p) => {
      const i = p.findIndex((x) => x.id === f.id);
      if (i >= 0) {
        const n = [...p];
        n[i] = f;
        return n;
      }
      return [f, ...p];
    });
    pushAudit({ action: isNew ? "training_create" : "training_update", entity: "training", detail: f.id });
    if (opts.syncToPeople) {
      syncRecordToPeople(f, { quiet: false });
    }
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="training matrix" />
      {modal?.type === "form" && (
        <Form item={modal.data} workers={workers} onSave={(f, opts) => persist(f, !modal.data, opts)} onClose={() => setModal(null)} />
      )}
      <PageHero exportModuleId="training"
        badgeText="TM"
        title="Training matrix"
        lead="Competence and refresher dates per worker — links to People for certificates and PTW eligibility."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {syncableCount > 0 && (
              <button type="button" style={ss.btn} onClick={syncAllToPeople} title="Copy expiries into worker certificates in People">
                Sync all to People
              </button>
            )}
            {items.length > 0 && (
              <button type="button" style={ss.btn} onClick={exportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add record
            </button>
          </div>
        }
      />

      {!stepsHidden && nextSteps.length > 0 ? (
        <PeopleNextSteps steps={nextSteps} onAction={runNextStepAction} onDismiss={hideNextSteps} />
      ) : null}

      <RegisterModuleShell
        moduleId="training"
        smartContext={{ items }}
        stats={buildRegisterModuleStats("training", items)}
      >

      {(expired.length > 0 || expiring.length > 0) && (
        <div style={{ ...ss.card, marginBottom: 12, background: expired.length ? "#fef2f2" : "#fffbeb", fontSize: 13 }}>
          {expired.length > 0 && <div style={{ marginBottom: 6 }}>Expired or overdue: {expired.length} record(s).</div>}
          {expiring.length > 0 && <div>Expiring within 60 days: {expiring.length} record(s).</div>}
        </div>
      )}
      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No training records. Add workers under the Workers tab first.</div>
      ) : (
        <div id="training-register" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(items) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, items.length)} of {items.length} records
            </div>
          ) : null}
          {listPg.visible(items).map((r) => {
            const d = r.expiryDate ? daysUntil(r.expiryDate) : null;
            return (
              <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{r.courseName || "Course"}</strong> · {r.workerName || "—"}
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      Completed {r.completedDate}
                      {r.expiryDate && (
                        <span style={{ color: d != null && d < 0 ? "#A32D2D" : d != null && d <= 60 ? "#b45309" : "inherit" }}> · Expires {r.expiryDate}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.workerId && r.expiryDate ? (
                      <button type="button" style={ss.btn} onClick={() => syncRecordToPeople(r)} title="Update matching certificate on worker in People">
                        Sync to People
                      </button>
                    ) : null}
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
                              moduleId: "training",
                              moduleLabel: "Training matrix",
                              itemType: "training_record",
                              itemLabel: `${r.workerName || "Worker"} — ${r.courseName || "Course"}`,
                              sourceKey: "training_matrix",
                              payload: r,
                            })
                          ) {
                            setItems((p) => p.filter((x) => x.id !== r.id));
                            pushAudit({ action: "training_delete", entity: "training", detail: r.id });
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {listPg.hasMore(items) ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(items)} remaining)
              </button>
            </div>
          ) : null}
        </div>
      )}

      </RegisterModuleShell>    </div>
  );
}
