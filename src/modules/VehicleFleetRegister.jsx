import { useMemo, useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import RegisterModuleShell from "../components/RegisterModuleShell";
import RegisterFormPrintButton from "../components/RegisterFormPrintButton";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { getVehicleDueAlerts } from "../utils/vehicleComplianceDue";

const genId = () => `veh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

function dueTone(days) {
  if (days == null) return "inherit";
  if (days < 0) return "#A32D2D";
  if (days <= 7) return "#b45309";
  if (days <= 30) return "#92400e";
  return "inherit";
}

function Form({ item, projects, workers, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        registration: "",
        makeModel: "",
        vehicleType: "van",
        projectId: "",
        assignedWorkerId: "",
        motDue: "",
        insuranceExpiry: "",
        nextServiceDue: "",
        taxDue: "",
        lastDailyCheckDate: "",
        status: "active",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const wm = Object.fromEntries(workers.map((w) => [w.id, w.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit vehicle" : "Fleet vehicle"}</h2>
        <label style={ss.lbl}>Registration</label>
        <input style={ss.inp} value={form.registration} onChange={(e) => set("registration", e.target.value)} placeholder="e.g. AB12 CDE" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Make / model</label>
        <input style={ss.inp} value={form.makeModel} onChange={(e) => set("makeModel", e.target.value)} placeholder="e.g. Ford Transit" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Type</label>
            <select style={ss.inp} value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)}>
              <option value="van">Van</option>
              <option value="car">Car</option>
              <option value="hgv">HGV</option>
              <option value="plant_road">Plant (road)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Status</label>
            <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="off_road">Off road</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project / site</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Assigned driver / operative</label>
        <select style={ss.inp} value={form.assignedWorkerId} onChange={(e) => set("assignedWorkerId", e.target.value)}>
          <option value="">—</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 12, marginBottom: 4 }}>Compliance dates</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 10 }}>
          <div>
            <label style={ss.lbl}>MOT due</label>
            <input type="date" style={ss.inp} value={form.motDue || ""} onChange={(e) => set("motDue", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Insurance expiry</label>
            <input type="date" style={ss.inp} value={form.insuranceExpiry || ""} onChange={(e) => set("insuranceExpiry", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Next service</label>
            <input type="date" style={ss.inp} value={form.nextServiceDue || ""} onChange={(e) => set("nextServiceDue", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Road tax due</label>
            <input type="date" style={ss.inp} value={form.taxDue || ""} onChange={(e) => set("taxDue", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Last daily check</label>
        <input type="date" style={ss.inp} value={form.lastDailyCheckDate || ""} onChange={(e) => set("lastDailyCheckDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={ss.btnP}
            onClick={() =>
              onSave({
                ...form,
                projectName: pm[form.projectId] || "",
                assignedWorkerName: wm[form.assignedWorkerId] || "",
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VehicleFleetRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("vehicle_register", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [workers, setWorkers] = useState(() => load("mysafeops_workers", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "vehicle_register",
    namespace: "vehicle_register",
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
  const { d1Hydrating: d1WorkersH, d1OutboxPending: d1WorkersO } = useD1OrgArraySync({
    storageKey: "mysafeops_workers",
    namespace: "mysafeops_workers",
    value: workers,
    setValue: setWorkers,
    load,
    save,
  });
  const d1Hydrating = d1ItemsH || d1ProjH || d1WorkersH;
  const d1OutboxPending = d1ItemsO || d1ProjO || d1WorkersO;

  const dueAlerts = getVehicleDueAlerts();
  const activeCount = useMemo(() => items.filter((i) => String(i.status || "active") !== "disposed").length, [items]);

  const exportCsv = () => {
    const h = ["Registration", "Make/model", "Type", "Project", "Driver", "MOT", "Insurance", "Service", "Tax", "Status"];
    const rows = items.map((r) => [
      r.registration,
      r.makeModel,
      r.vehicleType,
      r.projectName || "",
      r.assignedWorkerName || "",
      r.motDue || "",
      r.insuranceExpiry || "",
      r.nextServiceDue || "",
      r.taxDue || "",
      r.status,
    ]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `vehicle_register_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
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
    pushAudit({ action: isNew ? "vehicle_create" : "vehicle_update", entity: "vehicles", detail: f.id });
    setModal(null);
  };

  const recordDailyCheck = (vehicle) => {
    const stamp = today();
    if (vehicle.lastDailyCheckDate === stamp) return;
    const updated = { ...vehicle, lastDailyCheckDate: stamp };
    setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)));
    pushAudit({ action: "vehicle_daily_check", entity: "vehicles", detail: updated.id });
  };

  const renderDueLine = (label, iso) => {
    if (!iso) return null;
    const d = daysUntil(iso);
    return (
      <span style={{ fontSize: 11, marginRight: 10, color: dueTone(d) }}>
        {label}: {iso}
        {d != null && d < 0 ? ` (${Math.abs(d)}d overdue)` : d != null && d <= 30 ? ` (${d}d)` : ""}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="vehicle register" />
      {modal?.type === "form" && (
        <Form item={modal.data} projects={projects} workers={workers} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />
      )}
      <PageHero
        exportModuleId="vehicles"
        badgeText="FL"
        title="Fleet & vehicles"
        lead="MOT, insurance, service and tax dates — surfaced on the People compliance calendar."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {items.length > 0 && (
              <button type="button" style={ss.btn} onClick={exportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add vehicle
            </button>
          </div>
        }
      />

      <RegisterModuleShell moduleId="vehicles" smartContext={{ items }} stats={buildRegisterModuleStats("vehicles", items)}>
        {dueAlerts.length > 0 ? (
          <div style={{ ...ss.card, marginBottom: 12, background: dueAlerts.some((a) => a.severity === "expired") ? "#fef2f2" : "#fffbeb", fontSize: 13 }}>
            {dueAlerts.filter((a) => a.severity === "expired").length > 0 ? (
              <div style={{ marginBottom: 4 }}>
                Overdue: {dueAlerts.filter((a) => a.severity === "expired").length} compliance date(s) — do not deploy until resolved.
              </div>
            ) : null}
            Due within 30 days: {dueAlerts.length} item(s) across {activeCount} active vehicle(s).
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon="🚐"
            title="No vehicles on the register"
            description="Add vans, cars or HGVs with MOT and insurance dates."
            actionLabel="+ Add vehicle"
            onAction={() => setModal({ type: "form" })}
            variant="dashed"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listPg.visible(items).map((r) => (
              <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 88px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{r.registration || "No reg"}</strong>
                    {r.makeModel ? ` · ${r.makeModel}` : ""}
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                      {r.vehicleType || "vehicle"} · {r.status || "active"}
                      {r.projectName ? ` · ${r.projectName}` : ""}
                      {r.assignedWorkerName ? ` · ${r.assignedWorkerName}` : ""}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {renderDueLine("MOT", r.motDue)}
                      {renderDueLine("Insurance", r.insuranceExpiry)}
                      {renderDueLine("Service", r.nextServiceDue)}
                      {renderDueLine("Tax", r.taxDue)}
                    </div>
                    {r.lastDailyCheckDate ? (
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                        Last daily check: {r.lastDailyCheckDate}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {String(r.status || "active") === "active" ? (
                      <button
                        type="button"
                        style={ss.btn}
                        onClick={() => recordDailyCheck(r)}
                        title="Record today's walk-around / daily vehicle check"
                      >
                        {r.lastDailyCheckDate === today() ? "Checked today" : "Daily check"}
                      </button>
                    ) : null}
                    <RegisterFormPrintButton moduleId="vehicles" record={r} />
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
                              moduleId: "vehicles",
                              moduleLabel: "Fleet & vehicles",
                              itemType: "vehicle_record",
                              itemLabel: r.registration || r.makeModel || r.id,
                              sourceKey: "vehicle_register",
                              payload: r,
                            })
                          ) {
                            setItems((p) => p.filter((x) => x.id !== r.id));
                            pushAudit({ action: "vehicle_delete", entity: "vehicles", detail: r.id });
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
              hasMore={listPg.hasMore(items)}
              remaining={listPg.remaining(items)}
              showing={Math.min(listPg.cap, items.length)}
              total={items.length}
              onShowMore={listPg.showMore}
              buttonStyle={ss.btn}
              itemLabel="vehicles"
            />
          </div>
        )}
      </RegisterModuleShell>
    </div>
  );
}
