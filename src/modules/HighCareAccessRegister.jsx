import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const KEY = "high_care_access_register";
const genId = () => `hca_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const ss = ms;

function parseTools(s) {
  return String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        zoneName: "",
        zoneClass: "high_care",
        projectId: "",
        entryTimestamp: Date.now(),
        exitTimestamp: null,
        visitorName: "",
        visitorCompany: "",
        purpose: "",
        toolsIn: "",
        toolsOut: "",
        hygieneChecks: {
          handWash: false,
          dedicatedPpe: false,
          hairBeardNet: false,
          noJewellery: false,
          footwearChanged: false,
        },
        escortedBy: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setHy = (k, v) => setForm((f) => ({ ...f, hygieneChecks: { ...f.hygieneChecks, [k]: v } }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const inList = parseTools(form.toolsIn);
  const outList = parseTools(form.toolsOut);
  const toolOk = inList.length === outList.length && inList.every((t, i) => t === outList[i]);

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit access record" : "High-care / high-risk access"}</h2>
        <label style={ss.lbl}>Zone name</label>
        <input style={ss.inp} value={form.zoneName} onChange={(e) => set("zoneName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Zone class</label>
        <select style={ss.inp} value={form.zoneClass} onChange={(e) => set("zoneClass", e.target.value)}>
          <option value="high_risk">High risk</option>
          <option value="high_care">High care</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Visitor / engineer name</label>
        <input style={ss.inp} value={form.visitorName} onChange={(e) => set("visitorName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Company</label>
        <input style={ss.inp} value={form.visitorCompany} onChange={(e) => set("visitorCompany", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Purpose</label>
        <textarea style={{ ...ss.inp, minHeight: 44 }} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Escorted by</label>
        <input style={ss.inp} value={form.escortedBy} onChange={(e) => set("escortedBy", e.target.value)} />

        <div style={{ fontWeight: 600, marginTop: 14, fontSize: 12 }}>Hygiene confirmations</div>
        {[
          ["handWash", "Hand wash / sanitise"],
          ["dedicatedPpe", "Dedicated PPE donned"],
          ["hairBeardNet", "Hair / beard net"],
          ["noJewellery", "No jewellery confirmed"],
          ["footwearChanged", "Footwear changed"],
        ].map(([k, lab]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13 }}>
            <input type="checkbox" checked={!!form.hygieneChecks?.[k]} onChange={(e) => setHy(k, e.target.checked)} />
            {lab}
          </label>
        ))}

        <div style={{ fontWeight: 600, marginTop: 14, fontSize: 12 }}>Tool reconciliation (comma-separated, same order in/out)</div>
        <label style={ss.lbl}>Tools brought in</label>
        <input style={ss.inp} value={form.toolsIn} onChange={(e) => set("toolsIn", e.target.value)} placeholder="torx T20, shifter" />
        <label style={{ ...ss.lbl, marginTop: 8 }}>Tools taken out</label>
        <input style={ss.inp} value={form.toolsOut} onChange={(e) => set("toolsOut", e.target.value)} placeholder="must match in count and order for auto-check" />
        <div style={{ fontSize: 12, marginTop: 6, color: toolOk ? "#166534" : "#A32D2D", fontWeight: 600 }}>
          {toolOk ? "Tool list matches (count + order)." : "Mismatch — verify before sign-out."}
        </div>

        <label style={{ ...ss.lbl, marginTop: 10 }}>Exit time (leave blank if still on site)</label>
        <input
          type="datetime-local"
          style={ss.inp}
          value={form.exitTimestamp ? new Date(form.exitTimestamp).toISOString().slice(0, 16) : ""}
          onChange={(e) => set("exitTimestamp", e.target.value ? new Date(e.target.value).getTime() : null)}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave({ ...form, projectName: pm[form.projectId] || "", toolReconciliationOk: toolOk })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HighCareAccessRegister() {
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

  const openOnSite = items.filter((r) => !r.exitTimestamp);

  const exportCsv = () => {
    const h = ["Zone", "Class", "Visitor", "Company", "In", "Out", "Tools OK", "Project"];
    const rows = items.map((r) => [
      r.zoneName,
      r.zoneClass,
      r.visitorName,
      r.visitorCompany,
      r.entryTimestamp ? new Date(r.entryTimestamp).toISOString() : "",
      r.exitTimestamp ? new Date(r.exitTimestamp).toISOString() : "",
      r.toolReconciliationOk ? "yes" : "no",
      r.projectName || "",
    ]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "high_care_access.csv";
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
    pushAudit({ action: isNew ? "hca_create" : "hca_update", entity: "high_care_access", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="high-care access register" />
      {modal?.type === "form" && <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
      <PageHero
        badgeText="HC"
        title="High-care access"
        lead="Visitor / contractor access to high-care or high-risk zones with hygiene checks and tool reconciliation."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {openOnSite.length > 0 && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "#E0F2FE", color: "#0369A1" }}>
                {openOnSite.length} on site
              </span>
            )}
            {items.length > 0 && (
              <button type="button" style={ss.btn} onClick={exportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add entry
            </button>
          </div>
        }
      />
      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No entries yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(items).map((r) => (
            <div key={r.id} style={{ ...ss.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>{r.zoneName || "Zone"}</strong> · {r.visitorName}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {r.visitorCompany} · {r.exitTimestamp ? "Signed out" : "On site"}
                    {!r.toolReconciliationOk ? " · ⚠ tools" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
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
