import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `welf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        checkDate: today(),
        projectId: "",
        toiletsOk: true,
        handWashOk: true,
        drinkingWaterOk: true,
        dryingRoomOk: true,
        restShelterOk: true,
        changingOk: true,
        checkedBy: "",
        issues: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 480, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit welfare check" : "Welfare check"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>CDM 2015 Schedule 2 / site rules — tick what applies to your setup.</p>
        <label style={ss.lbl}>Date</label>
        <input type="date" style={ss.inp} value={form.checkDate} onChange={(e) => set("checkDate", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project / site</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 14 }}>Facilities</label>
        {[
          ["toiletsOk", "Toilets adequate & serviced"],
          ["handWashOk", "Hand washing (hot/cold or gel)"],
          ["drinkingWaterOk", "Drinking water"],
          ["dryingRoomOk", "Drying room / lockers (if required)"],
          ["restShelterOk", "Rest / mess shelter"],
          ["changingOk", "Changing / PPE storage"],
        ].map(([key, label]) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
            {label}
          </label>
        ))}
        <label style={{ ...ss.lbl, marginTop: 12 }}>Checked by</label>
        <input style={ss.inp} value={form.checkedBy} onChange={(e) => set("checkedBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Issues / actions</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.issues} onChange={(e) => set("issues", e.target.value)} />
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

export default function WelfareCheckLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("welfare_check_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Syncing: d1Welf } = useD1OrgArraySync({
    storageKey: "welfare_check_log",
    namespace: "welfare_check_log",
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
  const d1Syncing = d1Welf || d1Proj;

  const exportCsv = () => {
    const h = ["Date", "Project", "Toilets", "Wash", "Water", "Drying", "Rest", "Changing", "By", "Issues"];
    const rows = items.map((r) => [
      r.checkDate,
      r.projectName || "",
      r.toiletsOk ? "Y" : "N",
      r.handWashOk ? "Y" : "N",
      r.drinkingWaterOk ? "Y" : "N",
      r.dryingRoomOk ? "Y" : "N",
      r.restShelterOk ? "Y" : "N",
      r.changingOk ? "Y" : "N",
      r.checkedBy,
      r.issues,
    ]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `welfare_checks_${today()}.csv`;
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
    pushAudit({ action: isNew ? "welfare_create" : "welfare_update", entity: "welfare", detail: f.id });
    setModal(null);
  };

  const anyFail = (r) => !r.toiletsOk || !r.handWashOk || !r.drinkingWaterOk;

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {d1Syncing ? (
        <div
          className="app-panel-surface"
          style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}
        >
          Syncing welfare checks with cloud…
        </div>
      ) : null}
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="WF"
        title="Welfare checks"
        lead="Toilets, rest, water, drying — welfare monitoring (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add check
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No welfare checks recorded.</div>
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
                  <strong>{r.checkDate}</strong> · {r.projectName || "Site"}
                  {anyFail(r) && <span style={{ marginLeft: 8, fontSize: 11, color: "#A32D2D" }}>Review items</span>}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.checkedBy}</div>
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
                          pushAudit({ action: "welfare_delete", entity: "welfare", detail: r.id });
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
