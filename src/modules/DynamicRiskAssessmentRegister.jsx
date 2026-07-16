import { useState } from "react";
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
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const KEY = "dynamic_risk_assessments";
const genId = () => `dra_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const ss = ms;

function Form({ item, projects, ramsDocs, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        projectId: "",
        linkedRamsId: "",
        location: "",
        taskDescription: "",
        newHazards: "",
        additionalControls: "",
        residualRiskNote: "",
        authorName: "",
        authorRole: "",
        assessedAt: new Date().toISOString().slice(0, 16),
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit dynamic RA" : "Dynamic risk assessment (field)"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Record new hazards found on site that were not in the pre-written RAMS.</p>
        <label style={ss.lbl}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Linked RAMS (optional)</label>
        <select style={ss.inp} value={form.linkedRamsId} onChange={(e) => set("linkedRamsId", e.target.value)}>
          <option value="">—</option>
          {ramsDocs.filter((r) => !form.projectId || r.projectId === form.projectId).map((r) => (
            <option key={r.id} value={r.id}>{r.title || r.documentNo}</option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Location / work area</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Task / change in conditions</label>
        <textarea style={{ ...ss.inp, minHeight: 50 }} value={form.taskDescription} onChange={(e) => set("taskDescription", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>New hazards identified</label>
        <textarea style={{ ...ss.inp, minHeight: 60 }} value={form.newHazards} onChange={(e) => set("newHazards", e.target.value)} placeholder="One per line" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Additional controls applied</label>
        <textarea style={{ ...ss.inp, minHeight: 60 }} value={form.additionalControls} onChange={(e) => set("additionalControls", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Residual risk / supervisor decision</label>
        <input style={ss.inp} value={form.residualRiskNote} onChange={(e) => set("residualRiskNote", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Assessed by</label>
        <input style={ss.inp} value={form.authorName} onChange={(e) => set("authorName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Role</label>
        <input style={ss.inp} value={form.authorRole} onChange={(e) => set("authorRole", e.target.value)} placeholder="Supervisor / AP" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date & time</label>
        <input type="datetime-local" style={ss.inp} value={form.assessedAt} onChange={(e) => set("assessedAt", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Cancel</button>
          <button type="button" style={ss.btnP} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function DynamicRiskAssessmentRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(KEY, []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [ramsDocs] = useState(() => load("rams_builder_docs", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging();
  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: KEY,
    namespace: KEY,
    value: items,
    setValue: setItems,
    load,
    save,
  });

  const persist = (next) => {
    setItems(next);
    save(KEY, next);
  };

  return (
    <div>
      <PageHero
        title="Dynamic risk assessment"
        lead="Capture new on-site hazards and controls when conditions change — links to RAMS and projects."
        right={
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + New DRA
          </button>
        }
      />
      <D1ModuleSyncBanner hydrating={d1Hydrating} outboxPending={d1OutboxPending} />
      <RegisterModuleShell moduleId="dynamic-ra" smartContext={{ items }} stats={buildRegisterModuleStats("dynamic-ra", items)}>
        {items.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="No dynamic risk assessments yet"
            description="Capture new on-site hazards and controls when conditions change — links to RAMS and projects."
            actionLabel="+ New DRA"
            onAction={() => setModal({ type: "form" })}
            variant="dashed"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listPg.visible(items).map((item) => (
              <div key={item.id} style={{ ...ss.card, padding: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.location || item.taskDescription?.slice(0, 60) || "DRA"}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                  {item.authorName || "—"} · {item.assessedAt ? new Date(item.assessedAt).toLocaleString("en-GB") : "—"}
                </div>
                {item.newHazards ? <div style={{ fontSize: 12, marginTop: 6, whiteSpace: "pre-wrap" }}>{item.newHazards}</div> : null}
                {caps.canEditRegisters !== false ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => setModal({ type: "form", data: item })}>Edit</button>
                    {caps.deleteRecords ? (
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 12, color: "#791F1F" }}
                        onClick={() => {
                          if (
                            softDeleteToRecycleBin({
                              moduleId: "dynamic-ra",
                              moduleLabel: "Dynamic RA",
                              itemType: "dra_record",
                              itemLabel: item.location || item.id,
                              sourceKey: KEY,
                              payload: item,
                            })
                          ) {
                            persist(items.filter((x) => x.id !== item.id));
                            pushAudit({ action: "delete", entityType: "dynamic_risk_assessment", entityId: item.id });
                          }
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            <RegisterListPagingFooter
              hasMore={listPg.hasMore(items)}
              remaining={listPg.remaining(items)}
              showing={Math.min(listPg.cap, items.length)}
              total={items.length}
              onShowMore={listPg.showMore}
              buttonStyle={ss.btn}
            />
          </div>
        )}
      </RegisterModuleShell>
      {modal?.type === "form" ? (
        <Form
          item={modal.data}
          projects={projects}
          ramsDocs={ramsDocs}
          onClose={() => setModal(null)}
          onSave={(row) => {
            const next = modal.data ? items.map((x) => (x.id === row.id ? row : x)) : [row, ...items];
            persist(next);
            pushAudit({ action: modal.data ? "update" : "create", entityType: "dynamic_risk_assessment", entityId: row.id });
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}
