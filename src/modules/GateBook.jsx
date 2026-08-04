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
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import RegisterModuleShell from "../components/RegisterModuleShell";
import RegisterFormPrintButton from "../components/RegisterFormPrintButton";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { exportCsv } from "../utils/exportCsv";
import { validateRequiredFields } from "../utils/registerPersistGuard";

import { todayLocalISO } from "../utils/localDate";
const genId = () => `gate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        visitDate: today(),
        timeIn: "08:00",
        timeOut: "",
        vehicleReg: "",
        company: "",
        driverName: "",
        deliveryRef: "",
        purpose: "Delivery",
        projectId: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 540 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit gate entry" : "Gate / vehicle book"}</h2>
        <label style={ss.lbl} htmlFor="gate-book-visit-date">Date</label>
        <input type="date" style={ss.inp} value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)}  id="gate-book-visit-date" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="gate-book-time-in">Time in</label>
            <input type="time" style={ss.inp} value={form.timeIn} onChange={(e) => set("timeIn", e.target.value)}  id="gate-book-time-in" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="gate-book-time-out">Time out</label>
            <input type="time" style={ss.inp} value={form.timeOut || ""} onChange={(e) => set("timeOut", e.target.value)}  id="gate-book-time-out" />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="gate-book-vehicle-reg">Vehicle registration</label>
        <input style={ss.inp} value={form.vehicleReg} onChange={(e) => set("vehicleReg", e.target.value.toUpperCase())}  id="gate-book-vehicle-reg" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="gate-book-company">Company / haulier</label>
        <input style={ss.inp} value={form.company} onChange={(e) => set("company", e.target.value)}  id="gate-book-company" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="gate-book-driver-name">Driver</label>
        <input style={ss.inp} value={form.driverName} onChange={(e) => set("driverName", e.target.value)}  id="gate-book-driver-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="gate-book-purpose">Purpose</label>
        <select style={ss.inp} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} id="gate-book-purpose">
          <option value="Delivery">Delivery</option>
          <option value="Collection">Collection</option>
          <option value="Waste">Waste</option>
          <option value="Visitor vehicle">Visitor vehicle</option>
          <option value="Other">Other</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="gate-book-delivery-ref">Delivery note / ref</label>
        <input style={ss.inp} value={form.deliveryRef} onChange={(e) => set("deliveryRef", e.target.value)}  id="gate-book-delivery-ref" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="gate-book-project-id">Project / gate</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="gate-book-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="gate-book-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="gate-book-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["company","driverName"], { company: "Company", driverName: "Driver" });
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

export default function GateBook() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("gate_book", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1GateH, d1OutboxPending: d1GateO } = useD1OrgArraySync({
    storageKey: "gate_book",
    namespace: "gate_book",
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
  const d1Hydrating = d1GateH || d1ProjH;
  const d1OutboxPending = d1GateO || d1ProjO;

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Date", "In", "Out", "Reg", "Company", "Driver", "Purpose", "DN ref", "Project", "Notes"];
    const rows = liveItems.map((r) => [r.visitDate, r.timeIn, r.timeOut, r.vehicleReg, r.company, r.driverName, r.purpose, r.deliveryRef, r.projectName || "", r.notes]);
    exportCsv(h, rows, `gate_book_${today()}.csv`);
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
    pushAudit({ action: isNew ? "gate_create" : "gate_update", entity: "gate", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="gate book" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="gate"
        badgeText="GT"
        title="Gate book"
        lead="Site gate movements and deliveries (local only)."
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
        moduleId="gate"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("gate", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🚪"
          title="No gate entries yet"
          description="Log vehicles and visitors as they arrive on site."
          actionLabel="+ Add gate entry"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.vehicleReg}</strong> · {r.visitDate} {r.timeIn}
                  {r.timeOut ? `–${r.timeOut}` : ""}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.company} · {r.purpose}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="gate" record={r} />
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
                            moduleId: "gate",
                            moduleLabel: "Gate book",
                            itemType: "gate_entry",
                            itemLabel: r.vehicleReg || r.visitDate || r.id,
                            sourceKey: "gate_book",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "gate_delete", entity: "gate", detail: r.id });
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
