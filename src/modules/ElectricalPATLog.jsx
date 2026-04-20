import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `pat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        assetTag: "",
        description: "",
        location: "",
        projectId: "",
        testDate: today(),
        nextTestDue: "",
        result: "pass",
        testedBy: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit electrical check" : "Electrical / PAT record"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Portable appliance or fixed equipment inspection — frequency per your risk assessment.</p>
        <label style={ss.lbl}>Asset tag / ID</label>
        <input style={ss.inp} value={form.assetTag} onChange={(e) => set("assetTag", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Description</label>
        <input style={ss.inp} value={form.description} onChange={(e) => set("description", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Location</label>
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
            <label style={ss.lbl}>Test date</label>
            <input type="date" style={ss.inp} value={form.testDate} onChange={(e) => set("testDate", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Next due</label>
            <input type="date" style={ss.inp} value={form.nextTestDue || ""} onChange={(e) => set("nextTestDue", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Result</label>
        <select style={ss.inp} value={form.result} onChange={(e) => set("result", e.target.value)}>
          <option value="pass">Pass</option>
          <option value="fail">Fail / removed</option>
          <option value="repair">Repair then retest</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Tested by / company</label>
        <input style={ss.inp} value={form.testedBy} onChange={(e) => set("testedBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 44, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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

export default function ElectricalPATLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("electrical_pat_log", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("electrical_pat_log", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Tag", "Description", "Location", "Project", "Test date", "Next due", "Result", "Tested by"];
    const rows = items.map((r) => [r.assetTag, r.description, r.location, r.projectName || "", r.testDate, r.nextTestDue, r.result, r.testedBy]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `electrical_pat_${today()}.csv`;
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
    pushAudit({ action: isNew ? "pat_create" : "pat_update", entity: "pat", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="PAT"
        title="Electrical / PAT"
        lead="PAT and electrical inspection records (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add record
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No electrical / PAT records.</div>
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
                  <strong>{r.assetTag || "Asset"}</strong> · {r.testDate} · {r.result}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.description}</div>
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
                          pushAudit({ action: "pat_delete", entity: "pat", detail: r.id });
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
