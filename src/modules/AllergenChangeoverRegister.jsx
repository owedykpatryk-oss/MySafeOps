import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const KEY = "allergen_changeover_windows";
const genId = () => `acw_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const ss = ms;

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        label: "",
        siteLabel: "",
        projectId: "",
        fromAllergen: "",
        toAllergen: "",
        startAt: "",
        endAt: "",
        extraPpeHint: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit changeover window" : "Allergen changeover window"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>While the window is active, a banner appears in the app for all users. Use for line changeovers (e.g. milk → nut-free).</p>
        <label style={ss.lbl}>Short label</label>
        <input style={ss.inp} value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Line 3 allergen changeover" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Site / area label</label>
        <input style={ss.inp} value={form.siteLabel} onChange={(e) => set("siteLabel", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project (optional)</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>From (allergen / recipe)</label>
        <input style={ss.inp} value={form.fromAllergen} onChange={(e) => set("fromAllergen", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>To</label>
        <input style={ss.inp} value={form.toAllergen} onChange={(e) => set("toAllergen", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Window start</label>
        <input type="datetime-local" style={ss.inp} value={form.startAt} onChange={(e) => set("startAt", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Window end</label>
        <input type="datetime-local" style={ss.inp} value={form.endAt} onChange={(e) => set("endAt", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Extra controls / PPE hint (shown in banner)</label>
        <textarea style={{ ...ss.inp, minHeight: 44 }} value={form.extraPpeHint} onChange={(e) => set("extraPpeHint", e.target.value)} />

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

export default function AllergenChangeoverRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(KEY, []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);

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
    pushAudit({ action: isNew ? "allergen_window_create" : "allergen_window_update", entity: "allergen", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="allergen changeovers" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
      <PageHero
        badgeText="ALG"
        title="Allergen changeovers"
        lead="Define time windows for automatic in-app awareness banners."
        right={
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + New window
          </button>
        }
      />
      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No windows defined.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r) => (
            <div key={r.id} style={{ ...ss.card }}>
              <strong>{r.label || "Changeover"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {r.fromAllergen} → {r.toAllergen} · {r.siteLabel}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {r.startAt} — {r.endAt}
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
        </div>
      )}
    </div>
  );
}
