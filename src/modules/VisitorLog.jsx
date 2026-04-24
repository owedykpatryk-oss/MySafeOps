import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const genId = () => `vis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

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
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 540, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit visitor" : "Visitor sign-in"}</h2>
        <label style={ss.lbl}>Visitor name</label>
        <input style={ss.inp} value={form.visitorName} onChange={(e) => set("visitorName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Company</label>
        <input style={ss.inp} value={form.company} onChange={(e) => set("company", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Vehicle registration</label>
        <input style={ss.inp} value={form.vehicleReg} onChange={(e) => set("vehicleReg", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Host / escort</label>
        <input style={ss.inp} value={form.hostName} onChange={(e) => set("hostName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project / site</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Visit date</label>
        <input type="date" style={ss.inp} value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Time in</label>
            <input type="time" style={ss.inp} value={form.timeIn} onChange={(e) => set("timeIn", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Time out</label>
            <input type="time" style={ss.inp} value={form.timeOut || ""} onChange={(e) => set("timeOut", e.target.value)} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.inductionBriefed} onChange={(e) => set("inductionBriefed", e.target.checked)} />
          Site rules / induction briefed
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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

  const exportCsv = () => {
    const h = ["Date", "Visitor", "Company", "Vehicle", "Host", "Project", "In", "Out", "Induction", "Notes"];
    const rows = items.map((r) => [r.visitDate, r.visitorName, r.company, r.vehicleReg, r.hostName, r.projectName || "", r.timeIn, r.timeOut, r.inductionBriefed ? "yes" : "no", r.notes]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `visitor_log_${today()}.csv`;
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
    pushAudit({ action: isNew ? "visitor_create" : "visitor_update", entity: "visitor", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="visitor log" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="VIS"
        title="Visitor log"
        lead="Site visitors, induction status, and host details (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Sign in visitor
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No visitors recorded.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(items) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, items.length)} of {items.length} entries
            </div>
          ) : null}
          {listPg.visible(items).map((r) => (
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
