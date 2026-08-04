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
const genId = () => `vis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        visitorName: "",
        company: "",
        vehicleReg: "",
        hostName: "",
        projectId: "",
        visitDate: today(),
        timeIn: "09:00",
        timeOut: "",
        inductionBriefed: false,
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 540 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit visitor" : "Visitor sign-in"}</h2>
        <label style={ss.lbl} htmlFor="visitor-visitor-name">Visitor name</label>
        <input style={ss.inp} value={form.visitorName} onChange={(e) => set("visitorName", e.target.value)}  id="visitor-visitor-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="visitor-company">Company</label>
        <input style={ss.inp} value={form.company} onChange={(e) => set("company", e.target.value)}  id="visitor-company" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="visitor-vehicle-reg">Vehicle registration</label>
        <input style={ss.inp} value={form.vehicleReg} onChange={(e) => set("vehicleReg", e.target.value)}  id="visitor-vehicle-reg" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="visitor-host-name">Host / escort</label>
        <input style={ss.inp} value={form.hostName} onChange={(e) => set("hostName", e.target.value)}  id="visitor-host-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="visitor-project-id">Project / site</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="visitor-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="visitor-visit-date">Visit date</label>
        <input type="date" style={ss.inp} value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)}  id="visitor-visit-date" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="visitor-time-in">Time in</label>
            <input type="time" style={ss.inp} value={form.timeIn} onChange={(e) => set("timeIn", e.target.value)}  id="visitor-time-in" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="visitor-time-out">Time out</label>
            <input type="time" style={ss.inp} value={form.timeOut || ""} onChange={(e) => set("timeOut", e.target.value)}  id="visitor-time-out" />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.inductionBriefed} onChange={(e) => set("inductionBriefed", e.target.checked)} />
          Site rules / induction briefed
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="visitor-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="visitor-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["visitorName","visitDate"], { visitorName: "Visitor name", visitDate: "Visit date" });
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

export default function VisitorLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("visitor_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1VisH, d1OutboxPending: d1VisO } = useD1OrgArraySync({
    storageKey: "visitor_log",
    namespace: "visitor_log",
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
  const d1Hydrating = d1VisH || d1ProjH;
  const d1OutboxPending = d1VisO || d1ProjO;

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Date", "Visitor", "Company", "Vehicle", "Host", "Project", "In", "Out", "Induction", "Notes"];
    const rows = liveItems.map((r) => [r.visitDate, r.visitorName, r.company, r.vehicleReg, r.hostName, r.projectName || "", r.timeIn, r.timeOut, r.inductionBriefed ? "yes" : "no", r.notes]);
    exportCsv(h, rows, `visitor_log_${today()}.csv`);
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
    pushAudit({ action: isNew ? "visitor_create" : "visitor_update", entity: "visitor", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="visitor log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="visitors"
        badgeText="VIS"
        title="Visitor log"
        lead="Site visitors, induction status, and host details (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Sign in visitor
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="visitors"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("visitors", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No visitors recorded"
          description="Sign visitors in with host, company and induction status."
          actionLabel="+ Sign in visitor"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 80px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.visitorName}</strong> · {r.company}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {r.visitDate} {r.timeIn}
                    {r.timeOut ? `–${r.timeOut}` : ""} · Host: {r.hostName || "—"}
                  </div>
                  {!r.inductionBriefed && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Induction not recorded</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="visitors" record={r} />
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
                            moduleId: "visitors",
                            moduleLabel: "Visitor log",
                            itemType: "visitor",
                            itemLabel: r.visitorName || r.company || r.id,
                            sourceKey: "visitor_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "visitor_delete", entity: "visitor", detail: r.id });
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
            itemLabel="entries"
          />
        </div>
      )}

      </RegisterModuleShell>    </div>
  );
}
