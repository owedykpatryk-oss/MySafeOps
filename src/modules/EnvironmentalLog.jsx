import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `env_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

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
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 540, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit environmental event" : "Environmental event"}</h2>
        <label style={ss.lbl}>Category</label>
        <select style={ss.inp} value={form.category} onChange={(e) => set("category", e.target.value)}>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date</label>
        <input type="date" style={ss.inp} value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Description</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.description} onChange={(e) => set("description", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Immediate action</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.immediateAction} onChange={(e) => set("immediateAction", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Reported to (e.g. EA, client)</label>
        <input style={ss.inp} value={form.reportedTo} onChange={(e) => set("reportedTo", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.closedOut} onChange={(e) => set("closedOut", e.target.checked)} />
          Closed out
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Further notes</label>
        <textarea style={{ ...ss.inp, minHeight: 40, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
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

export default function EnvironmentalLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("environmental_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Syncing: d1Items } = useD1OrgArraySync({
    storageKey: "environmental_log",
    namespace: "environmental_log",
    value: items,
    setValue: setItems,
    load,
    save,
  });
  const { d1Syncing: d1Proj } = useD1OrgArraySync({
    storageKey: "mysafeops_projects",
    namespace: "mysafeops_projects",
    value: projects,
    setValue: setProjects,
    load,
    save,
  });
  const d1Syncing = d1Items || d1Proj;

  const exportCsv = () => {
    const h = ["Date", "Category", "Project", "Description", "Action", "Reported to", "Closed"];
    const rows = items.map((r) => [r.eventDate, r.category, r.projectName || "", r.description, r.immediateAction, r.reportedTo, r.closedOut ? "yes" : "no"]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `environmental_log_${today()}.csv`;
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
    pushAudit({ action: isNew ? "environmental_create" : "environmental_update", entity: "environmental", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {d1Syncing ? (
        <div
          className="app-panel-surface"
          style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}
        >
          Syncing environmental log with cloud…
        </div>
      ) : null}
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="ENV"
        title="Environmental log"
        lead="Spills, bund checks, and environmental notes (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add event
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No environmental events logged.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(items) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, items.length)} of {items.length} records
            </div>
          ) : null}
          {listPg.visible(items).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.category}</strong> · {r.eventDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.description?.slice(0, 140) || "—"}</div>
                  {!r.closedOut && <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>Open</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    Edit
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (confirm("Delete?")) {
                          setItems((p) => p.filter((x) => x.id !== r.id));
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
          {listPg.hasMore(items) ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(items)} remaining)
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
