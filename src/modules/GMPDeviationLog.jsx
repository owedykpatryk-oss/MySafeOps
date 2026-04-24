import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const KEY = "gmp_deviation_log";
const genId = () => `gmp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        siteLabel: "",
        projectId: "",
        batchRef: "",
        deviationType: "unplanned",
        description: "",
        immediateAction: "",
        qualityNotifiedAt: null,
        qualityContact: "",
        capaRef: "",
        closedAt: null,
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 600, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit GMP deviation" : "GMP deviation"}</h2>
        <label style={ss.lbl}>Site / area</label>
        <input style={ss.inp} value={form.siteLabel} onChange={(e) => set("siteLabel", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Batch / lot reference</label>
        <input style={ss.inp} value={form.batchRef} onChange={(e) => set("batchRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Deviation type</label>
        <select style={ss.inp} value={form.deviationType} onChange={(e) => set("deviationType", e.target.value)}>
          <option value="planned">Planned (documented)</option>
          <option value="unplanned">Unplanned</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Description</label>
        <textarea style={{ ...ss.inp, minHeight: 72 }} value={form.description} onChange={(e) => set("description", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Immediate action taken</label>
        <textarea style={{ ...ss.inp, minHeight: 52 }} value={form.immediateAction} onChange={(e) => set("immediateAction", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Quality notified at</label>
        <input
          type="datetime-local"
          style={ss.inp}
          value={form.qualityNotifiedAt ? new Date(form.qualityNotifiedAt).toISOString().slice(0, 16) : ""}
          onChange={(e) => set("qualityNotifiedAt", e.target.value ? new Date(e.target.value).getTime() : null)}
        />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Quality contact</label>
        <input style={ss.inp} value={form.qualityContact} onChange={(e) => set("qualityContact", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>CAPA reference</label>
        <input style={ss.inp} value={form.capaRef} onChange={(e) => set("capaRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Closed at (if closed)</label>
        <input
          type="datetime-local"
          style={ss.inp}
          value={form.closedAt ? new Date(form.closedAt).toISOString().slice(0, 16) : ""}
          onChange={(e) => set("closedAt", e.target.value ? new Date(e.target.value).getTime() : null)}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave({ ...form, projectName: pm[form.projectId] || "" })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GMPDeviationLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(KEY, []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: KEY,
    namespace: KEY,
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

  const exportCsv = () => {
    const h = ["Batch", "Type", "Site", "Project", "Closed", "CAPA"];
    const rows = items.map((r) => [r.batchRef, r.deviationType, r.siteLabel, r.projectName || "", r.closedAt ? "yes" : "no", r.capaRef]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "gmp_deviations.csv";
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
    pushAudit({ action: isNew ? "gmp_create" : "gmp_update", entity: "gmp", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="GMP deviation log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
      <PageHero
        badgeText="GMP"
        title="GMP deviation log"
        lead="Pharma-style deviation logging for QA traceability (export to CSV for document control)."
        right={
          <div style={{ display: "flex", gap: 8 }}>
            {items.length > 0 && (
              <button type="button" style={ss.btn} onClick={exportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add deviation
            </button>
          </div>
        }
      />
      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No deviations logged.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(items).map((r) => (
            <div key={r.id} style={{ ...ss.card }}>
              <strong>{r.batchRef || "Batch"}</strong> · {r.deviationType}
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{(r.description || "").slice(0, 120)}{(r.description || "").length > 120 ? "…" : ""}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                  Edit
                </button>
                {caps.deleteRecords && (
                  <button
                    type="button"
                    style={{ ...ss.btn, color: "#A32D2D" }}
                    onClick={() => {
                      if (!confirm("Delete?")) return;
                      setItems((p) => p.filter((x) => x.id !== r.id));
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {listPg.hasMore(items) ? (
            <button type="button" style={ss.btn} onClick={listPg.showMore}>
              Show more
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
