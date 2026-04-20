import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        permitRef: "",
        workDescription: "",
        location: "",
        projectId: "",
        workDate: today(),
        timeFrom: "08:00",
        timeTo: "17:00",
        fireWatchName: "",
        extinguishersChecked: false,
        combustiblesRemoved: false,
        gasTestRef: "",
        issuedBy: "",
        status: "active",
        closedAt: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 540, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit hot work" : "Hot work record"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Supports UK site practice — link to your permit-to-work where used.</p>
        <label style={ss.lbl}>Permit / reference</label>
        <input style={ss.inp} value={form.permitRef} onChange={(e) => set("permitRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Work description</label>
        <textarea style={{ ...ss.inp, minHeight: 52, resize: "vertical" }} value={form.workDescription} onChange={(e) => set("workDescription", e.target.value)} />
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
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date</label>
        <input type="date" style={ss.inp} value={form.workDate} onChange={(e) => set("workDate", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>From</label>
            <input type="time" style={ss.inp} value={form.timeFrom} onChange={(e) => set("timeFrom", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>To</label>
            <input type="time" style={ss.inp} value={form.timeTo} onChange={(e) => set("timeTo", e.target.value)} />
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Fire watch (name)</label>
        <input style={ss.inp} value={form.fireWatchName} onChange={(e) => set("fireWatchName", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.extinguishersChecked} onChange={(e) => set("extinguishersChecked", e.target.checked)} />
          Suitable extinguishers checked / available
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={form.combustiblesRemoved} onChange={(e) => set("combustiblesRemoved", e.target.checked)} />
          Combustibles removed or protected (where applicable)
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Atmosphere / gas test ref (if required)</label>
        <input style={ss.inp} value={form.gasTestRef} onChange={(e) => set("gasTestRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Issued by</label>
        <input style={ss.inp} value={form.issuedBy} onChange={(e) => set("issuedBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Status</label>
        <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="active">Active</option>
          <option value="completed">Completed / cooled</option>
          <option value="cancelled">Cancelled</option>
        </select>
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

export default function HotWorkRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("hot_work_register", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("hot_work_register", items);
  }, [items]);

  const activeCount = items.filter((r) => r.status === "active").length;

  const exportCsv = () => {
    const h = ["Permit", "Date", "Location", "Project", "From", "To", "Fire watch", "Status", "Issued by"];
    const rows = items.map((r) => [r.permitRef, r.workDate, r.location, r.projectName || "", r.timeFrom, r.timeTo, r.fireWatchName, r.status, r.issuedBy]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `hot_work_${today()}.csv`;
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
    pushAudit({ action: isNew ? "hot_work_create" : "hot_work_update", entity: "hot_work", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="HW"
        title="Hot work register"
        lead="Welding, cutting, grinding — align with your fire plan and PTW module."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {activeCount > 0 && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "#FAEEDA", color: "#633806" }}>
                {activeCount} active
              </span>
            )}
            {items.length > 0 && (
              <button type="button" style={ss.btn} onClick={exportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add record
            </button>
          </div>
        }
      />
      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No hot work records.</div>
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
                  <strong>{r.permitRef || "Hot work"}</strong> · {r.workDate} {r.timeFrom}–{r.timeTo}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.location} · {r.status}</div>
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
                          pushAudit({ action: "hot_work_delete", entity: "hot_work", detail: r.id });
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
