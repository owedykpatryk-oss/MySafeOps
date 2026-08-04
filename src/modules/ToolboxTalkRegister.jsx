import { useState } from "react";
import ModuleOverlay from "../components/ModuleOverlay";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
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
import { printRegisterFormPack } from "../utils/registerFormPrint";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { exportCsv } from "../utils/exportCsv";
import { validateRequiredFields } from "../utils/registerPersistGuard";

import { todayLocalISO } from "../utils/localDate";
const genId = () => `tt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

const presenterLabel = (w) => `${w.name || ""}${w.role ? ` — ${w.role}` : ""}`.trim();

function initialPresenterPick(item, workers) {
  if (!item?.presenter?.trim()) return "";
  const p = item.presenter.trim();
  const byLine = workers.find((w) => presenterLabel(w) === p);
  if (byLine) return byLine.id;
  const byName = workers.find((w) => (w.name || "").trim() === p);
  if (byName) return byName.id;
  return "__custom__";
}

function Form({ item, projects, workers, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        topic: "",
        talkDate: today(),
        projectId: "",
        presenter: "",
        attendeeCount: "",
        summary: "",
        createdAt: new Date().toISOString(),
      }
  );
  const [presentPick, setPresentPick] = useState(() => initialPresenterPick(item, workers));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const onPresenterSelect = (e) => {
    const v = e.target.value;
    if (v === "") {
      setPresentPick("");
      set("presenter", "");
      return;
    }
    if (v === "__custom__") {
      setPresentPick("__custom__");
      return;
    }
    const w = workers.find((x) => x.id === v);
    if (w) {
      setPresentPick(v);
      set("presenter", presenterLabel(w) || w.name);
    }
  };

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit toolbox talk" : "Toolbox talk record"}</h2>
        <label style={ss.lbl} htmlFor="toolbox-talk-topic">Topic</label>
        <input style={ss.inp} value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="e.g. Working at height, manual handling"  id="toolbox-talk-topic" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="toolbox-talk-talk-date">Date delivered</label>
        <input type="date" style={ss.inp} value={form.talkDate} onChange={(e) => set("talkDate", e.target.value)}  id="toolbox-talk-talk-date" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="toolbox-talk-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="toolbox-talk-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Presenter</label>
        {workers.length > 0 ? (
          <>
            <select style={ss.inp} value={presentPick} onChange={onPresenterSelect}>
              <option value="">— Select from my workers —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {presenterLabel(w) || w.name}
                </option>
              ))}
              <option value="__custom__">Other (type name)</option>
            </select>
            {presentPick === "__custom__" && (
              <input
                style={{ ...ss.inp, marginTop: 8 }}
                value={form.presenter}
                onChange={(e) => set("presenter", e.target.value)}
                placeholder="Presenter name"
              />
            )}
          </>
        ) : (
          <input style={ss.inp} value={form.presenter} onChange={(e) => set("presenter", e.target.value)} placeholder="Presenter name" />
        )}
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="toolbox-talk-attendee-count">Approx. attendees</label>
        <input style={ss.inp} inputMode="numeric" value={form.attendeeCount} onChange={(e) => set("attendeeCount", e.target.value)}  id="toolbox-talk-attendee-count" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="toolbox-talk-summary">Summary / key points</label>
        <textarea style={{ ...ss.inp, minHeight: 72, resize: "vertical" }} value={form.summary} onChange={(e) => set("summary", e.target.value)}  id="toolbox-talk-summary" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["topic","talkDate"], { topic: "Topic", talkDate: "Date" });
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

export default function ToolboxTalkRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("toolbox_talks", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [workers, setWorkers] = useState(() => load("mysafeops_workers", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ListH, d1OutboxPending: d1ListO } = useD1OrgArraySync({
    storageKey: "toolbox_talks",
    namespace: "toolbox_talks",
    value: items,
    setValue: setItems,
    load,
    save,
  });
  const { d1Hydrating: d1WpH, d1OutboxPending: d1WpO } = useD1WorkersProjectsSync({
    workers,
    setWorkers,
    projects,
    setProjects,
    load,
    save,
  });
  const d1Hydrating = d1ListH || d1WpH;
  const d1OutboxPending = d1ListO || d1WpO;

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Date", "Topic", "Project", "Presenter", "Attendees", "Summary"];
    const rows = liveItems.map((r) => [r.talkDate, r.topic, r.projectName || "", r.presenter, r.attendeeCount, r.summary]);
    exportCsv(h, rows, `toolbox_talks_${today()}.csv`);
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
    pushAudit({ action: isNew ? "toolbox_talk_create" : "toolbox_talk_update", entity: "toolbox", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="toolbox data" />
      {modal?.type === "form" && (
        <Form item={modal.data} projects={projects} workers={workers} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />
      )}
      <PageHero
        badgeText="TT"
        title="Toolbox talks (register)"
        lead="Log toolbox talks on site — print a branded A4 talk sheet with attendance signature lines."
        exportModuleId="toolbox-reg"
        exportModuleLabel="Toolbox talk register"
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {liveItems.length > 0 && (
              <>
                <button
                  type="button"
                  style={ss.btn}
                  onClick={() => {
                    printRegisterFormPack("toolbox-reg", items);
                  }}
                  title="Print branded A4 talk sheets with attendance lines"
                >
                  Print forms pack
                </button>
                <button type="button" style={ss.btn} onClick={handleExportCsv}>
                  Export CSV
                </button>
              </>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add talk
            </button>
          </div>
        }
      />
      <RegisterModuleShell
        moduleId="toolbox-reg"
        smartContext={{ items: liveItems }}
        stats={
          items.length > 0
            ? [
                { label: "Talks logged", value: items.length, tone: "neutral" },
                {
                  label: "This month",
                  value: items.filter((r) => String(r.talkDate || "").slice(0, 7) === today().slice(0, 7)).length,
                  tone: "good",
                },
              ]
            : []
        }
      >
        {liveItems.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No toolbox talks logged yet"
            description="Record toolbox talks, topics and attendance for this site."
            actionLabel="+ Add talk"
            onAction={() => setModal({ type: "form" })}
            variant="dashed"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listPg.visible(liveItems).map((r) => (
              <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{r.topic || "Topic"}</strong> · {r.talkDate}
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.presenter} · {r.attendeeCount ? `${r.attendeeCount} attendees` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <RegisterFormPrintButton moduleId="toolbox-reg" record={r} />
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
                              moduleId: "toolbox-reg",
                              moduleLabel: "Toolbox talks",
                              itemType: "toolbox_talk",
                              itemLabel: r.topic || r.id,
                              sourceKey: "toolbox_talks",
                              payload: r,
                            })
                          ) {
                            setItems((p) => replaceWithTombstone(p, r.id));
                            pushAudit({ action: "toolbox_talk_delete", entity: "toolbox", detail: r.id });
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
      </RegisterModuleShell>
    </div>
  );
}
