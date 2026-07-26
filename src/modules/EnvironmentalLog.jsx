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
const genId = () => `env_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

const CATS = ["Spill / leak", "Dust / emissions", "Noise complaint", "Waste non-compliance", "Protected species / ecology", "Other"];

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        category: "Spill / leak",
        eventDate: today(),
        projectId: "",
        description: "",
        immediateAction: "",
        reportedTo: "",
        closedOut: false,
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 540 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit environmental event" : "Environmental event"}</h2>
        <label style={ss.lbl} htmlFor="environmental-category">Category</label>
        <select style={ss.inp} value={form.category} onChange={(e) => set("category", e.target.value)} id="environmental-category">
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="environmental-event-date">Date</label>
        <input type="date" style={ss.inp} value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)}  id="environmental-event-date" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="environmental-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="environmental-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="environmental-description">Description</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.description} onChange={(e) => set("description", e.target.value)}  id="environmental-description" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="environmental-immediate-action">Immediate action</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.immediateAction} onChange={(e) => set("immediateAction", e.target.value)}  id="environmental-immediate-action" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="environmental-reported-to">Reported to (e.g. EA, client)</label>
        <input style={ss.inp} value={form.reportedTo} onChange={(e) => set("reportedTo", e.target.value)}  id="environmental-reported-to" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.closedOut} onChange={(e) => set("closedOut", e.target.checked)} />
          Closed out
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="environmental-notes">Further notes</label>
        <textarea style={{ ...ss.inp, minHeight: 40, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="environmental-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["description","eventDate"], { description: "Description", eventDate: "Event date" });
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

export default function EnvironmentalLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("environmental_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "environmental_log",
    namespace: "environmental_log",
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
    const h = ["Date", "Category", "Project", "Description", "Action", "Reported to", "Closed"];
    const rows = liveItems.map((r) => [r.eventDate, r.category, r.projectName || "", r.description, r.immediateAction, r.reportedTo, r.closedOut ? "yes" : "no"]);
    exportCsv(h, rows, `environmental_log_${today()}.csv`);
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
    pushAudit({ action: isNew ? "environmental_create" : "environmental_update", entity: "environmental", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="environmental log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero exportModuleId="environmental"
        badgeText="ENV"
        title="Environmental log"
        lead="Spills, bund checks, and environmental notes (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add event
          </button>
        </div>}
      />

      <RegisterModuleShell
        moduleId="environmental"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("environmental", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🌿"
          title="No environmental events logged"
          description="Record spills, bund checks and environmental notes."
          actionLabel="+ Add event"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.category}</strong> · {r.eventDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.description?.slice(0, 140) || "—"}</div>
                  {!r.closedOut && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Open</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="environmental" record={r} />
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
                            moduleId: "environmental",
                            moduleLabel: "Environmental log",
                            itemType: "environmental_event",
                            itemLabel: r.category || r.eventDate || r.id,
                            sourceKey: "environmental_log",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
                          pushAudit({ action: "environmental_delete", entity: "environmental", detail: r.id });
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
