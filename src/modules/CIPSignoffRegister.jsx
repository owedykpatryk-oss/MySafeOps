import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const KEY = "cip_signoff_register";
const genId = () => `cip_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        equipmentId: "",
        workOrderRef: "",
        projectId: "",
        cipRunAt: Date.now(),
        cipProgram: "",
        cipTemperaturePeakC: "",
        cipDurationMinutes: "",
        swabResults: [{ location: "", atpRlu: "", pass: true }],
        visualInspectionPassed: false,
        signedOffBy: "",
        releasedToProductionAt: null,
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const addSwab = () => set("swabResults", [...(form.swabResults || []), { location: "", atpRlu: "", pass: true }]);
  const patchSwab = (idx, patch) => {
    const next = [...(form.swabResults || [])];
    next[idx] = { ...next[idx], ...patch };
    set("swabResults", next);
  };

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit CIP sign-off" : "CIP sign-off"}</h2>
        <label style={ss.lbl}>Equipment ID</label>
        <input style={ss.inp} value={form.equipmentId} onChange={(e) => set("equipmentId", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Work order ref</label>
        <input style={ss.inp} value={form.workOrderRef} onChange={(e) => set("workOrderRef", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>CIP program</label>
        <input style={ss.inp} value={form.cipProgram} onChange={(e) => set("cipProgram", e.target.value)} placeholder="e.g. Standard 4-step caustic" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Peak temperature (°C)</label>
        <input style={ss.inp} inputMode="decimal" value={form.cipTemperaturePeakC} onChange={(e) => set("cipTemperaturePeakC", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Duration (minutes)</label>
        <input style={ss.inp} inputMode="numeric" value={form.cipDurationMinutes} onChange={(e) => set("cipDurationMinutes", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>CIP run time</label>
        <input type="datetime-local" style={ss.inp} value={form.cipRunAt ? new Date(form.cipRunAt).toISOString().slice(0, 16) : ""} onChange={(e) => set("cipRunAt", e.target.value ? new Date(e.target.value).getTime() : null)} />

        <div style={{ fontWeight: 600, marginTop: 14 }}>ATP / swab results</div>
        <button type="button" style={{ ...ss.btn, marginTop: 6 }} onClick={addSwab}>
          + Row
        </button>
        {(form.swabResults || []).map((s, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 6, marginTop: 8, alignItems: "end" }}>
            <div>
              <label style={ss.lbl}>Location</label>
              <input style={ss.inp} value={s.location} onChange={(e) => patchSwab(idx, { location: e.target.value })} />
            </div>
            <div>
              <label style={ss.lbl}>ATP RLU</label>
              <input style={ss.inp} value={s.atpRlu} onChange={(e) => patchSwab(idx, { atpRlu: e.target.value })} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, paddingBottom: 8 }}>
              <input type="checkbox" checked={!!s.pass} onChange={(e) => patchSwab(idx, { pass: e.target.checked })} />
              Pass
            </label>
          </div>
        ))}

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.visualInspectionPassed} onChange={(e) => set("visualInspectionPassed", e.target.checked)} />
          Visual inspection passed
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Signed off by</label>
        <input style={ss.inp} value={form.signedOffBy} onChange={(e) => set("signedOffBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Released to production</label>
        <input
          type="datetime-local"
          style={ss.inp}
          value={form.releasedToProductionAt ? new Date(form.releasedToProductionAt).toISOString().slice(0, 16) : ""}
          onChange={(e) => set("releasedToProductionAt", e.target.value ? new Date(e.target.value).getTime() : null)}
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

export default function CIPSignoffRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(KEY, []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save(KEY, items);
  }, [items]);

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
    pushAudit({ action: isNew ? "cip_create" : "cip_update", entity: "cip", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
      <PageHero
        badgeText="CIP"
        title="CIP sign-off"
        lead="Clean-in-place runs with ATP swab results and release-to-production time."
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add record
            </button>
          </div>
        }
      />
      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No CIP records.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(items).map((r) => (
            <div key={r.id} style={{ ...ss.card }}>
              <strong>{r.equipmentId || "Equipment"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {r.cipProgram} · {r.signedOffBy || "—"} · {(r.swabResults || []).filter((x) => x.pass).length}/{(r.swabResults || []).length} swabs pass
              </div>
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
