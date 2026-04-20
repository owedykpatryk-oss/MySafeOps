import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `lad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        ladderRef: "",
        type: "Extension",
        location: "",
        projectId: "",
        inspectionDate: today(),
        nextDue: "",
        result: "pass",
        inspector: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit ladder check" : "Ladder inspection"}</h2>
        <label style={ss.lbl}>Ladder ID / tag</label>
        <input style={ss.inp} value={form.ladderRef} onChange={(e) => set("ladderRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Type</label>
        <select style={ss.inp} value={form.type} onChange={(e) => set("type", e.target.value)}>
          <option value="Extension">Extension</option>
          <option value="Step">Step</option>
          <option value="Platform">Platform / podium</option>
          <option value="Other">Other</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Location / stored</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Inspection date</label>
            <input type="date" style={ss.inp} value={form.inspectionDate} onChange={(e) => set("inspectionDate", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Next due</label>
            <input type="date" style={ss.inp} value={form.nextDue || ""} onChange={(e) => set("nextDue", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Result</label>
        <select style={ss.inp} value={form.result} onChange={(e) => set("result", e.target.value)}>
          <option value="pass">Satisfactory</option>
          <option value="repair">Repair before use</option>
          <option value="withdrawn">Withdrawn / scrap</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Inspector</label>
        <input style={ss.inp} value={form.inspector} onChange={(e) => set("inspector", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes / defects</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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

export default function LadderInspection() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("ladder_inspections", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("ladder_inspections", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Ladder ref", "Type", "Location", "Project", "Date", "Next due", "Result", "Inspector"];
    const rows = items.map((r) => [r.ladderRef, r.type, r.location, r.projectName || "", r.inspectionDate, r.nextDue, r.result, r.inspector]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `ladder_inspections_${today()}.csv`;
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
    pushAudit({ action: isNew ? "ladder_create" : "ladder_update", entity: "ladder", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="LD"
        title="Ladder inspections"
        lead="Pre-use and formal ladder inspection records (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add inspection
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No ladder inspections recorded.</div>
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
                  <strong>{r.ladderRef || "No ref"}</strong> · {r.type} · {r.inspectionDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.location} · {r.result}</div>
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
                          pushAudit({ action: "ladder_delete", entity: "ladder", detail: r.id });
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
