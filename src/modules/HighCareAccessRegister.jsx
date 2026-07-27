import { useState } from "react";
import ModuleOverlay from "../components/ModuleOverlay";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import RegisterModuleShell from "../components/RegisterModuleShell";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { exportCsv } from "../utils/exportCsv";

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
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 560 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit access record" : "High-care / high-risk access"}</h2>
        <label style={ss.lbl} htmlFor="high-care-access-zone-name">Zone name</label>
        <input style={ss.inp} value={form.zoneName} onChange={(e) => set("zoneName", e.target.value)}  id="high-care-access-zone-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="high-care-access-zone-class">Zone class</label>
        <select style={ss.inp} value={form.zoneClass} onChange={(e) => set("zoneClass", e.target.value)} id="high-care-access-zone-class">
          <option value="high_risk">High risk</option>
          <option value="high_care">High care</option>
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="high-care-access-project-id">Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)} id="high-care-access-project-id">
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="high-care-access-visitor-name">Visitor / engineer name</label>
        <input style={ss.inp} value={form.visitorName} onChange={(e) => set("visitorName", e.target.value)}  id="high-care-access-visitor-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="high-care-access-visitor-company">Company</label>
        <input style={ss.inp} value={form.visitorCompany} onChange={(e) => set("visitorCompany", e.target.value)}  id="high-care-access-visitor-company" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="high-care-access-purpose">Purpose</label>
        <textarea style={{ ...ss.inp, minHeight: 44 }} value={form.purpose} onChange={(e) => set("purpose", e.target.value)}  id="high-care-access-purpose" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="high-care-access-escorted-by">Escorted by</label>
        <input style={ss.inp} value={form.escortedBy} onChange={(e) => set("escortedBy", e.target.value)}  id="high-care-access-escorted-by" />

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
        <label style={ss.lbl} htmlFor="high-care-access-tools-in">Tools brought in</label>
        <input style={ss.inp} value={form.toolsIn} onChange={(e) => set("toolsIn", e.target.value)} placeholder="torx T20, shifter"  id="high-care-access-tools-in" />
        <label style={{ ...ss.lbl, marginTop: 8 }} htmlFor="high-care-access-tools-out">Tools taken out</label>
        <input style={ss.inp} value={form.toolsOut} onChange={(e) => set("toolsOut", e.target.value)} placeholder="must match in count and order for auto-check"  id="high-care-access-tools-out" />
        <div style={{ fontSize: 12, marginTop: 6, color: toolOk ? "#166534" : "#A32D2D", fontWeight: 600 }}>
          {toolOk ? "Tool list matches (count + order)." : "Mismatch — verify before sign-out."}
        </div>

        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="high-care-access-exit-timestamp">Exit time (leave blank if still on site)</label>
        <input
          type="datetime-local"
          style={ss.inp}
          value={form.exitTimestamp ? new Date(form.exitTimestamp).toISOString().slice(0, 16) : ""}
          onChange={(e) => set("exitTimestamp", e.target.value ? new Date(e.target.value).getTime() : null)}
         id="high-care-access-exit-timestamp" />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave({ ...form, projectName: pm[form.projectId] || "", toolReconciliationOk: toolOk })}>
            Save
          </button>
        </div>
      </div>
    </ModuleOverlay>
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

  const liveItems = liveOrgArrayRows(items);

  const openOnSite = items.filter((r) => !r.exitTimestamp);

  const handleExportCsv = () => {
    const h = ["Zone", "Class", "Visitor", "Company", "In", "Out", "Tools OK", "Project"];
    const rows = liveItems.map((r) => [
      r.zoneName,
      r.zoneClass,
      r.visitorName,
      r.visitorCompany,
      r.entryTimestamp ? new Date(r.entryTimestamp).toISOString() : "",
      r.exitTimestamp ? new Date(r.exitTimestamp).toISOString() : "",
      r.toolReconciliationOk ? "yes" : "no",
      r.projectName || "",
    ]);
    exportCsv(h, rows, "high_care_access.csv");
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
      <PageHero exportModuleId="high-care-access"
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
            {liveItems.length > 0 && (
              <button type="button" style={ss.btn} onClick={handleExportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add entry
            </button>
          </div>
        }
      />

      <RegisterModuleShell
        moduleId="high-care-access"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("high-care-access", liveItems)}
      >

      {liveItems.length === 0 ? (
        <EmptyState
          icon="🧼"
          title="No entries yet"
          description="Log visitor and contractor access to high-care zones with hygiene checks and tool reconciliation."
          actionLabel="+ Add entry"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
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
                        if (
                          softDeleteToRecycleBin({
                            moduleId: "high-care-access",
                            moduleLabel: "High-care access",
                            itemType: "access_record",
                            itemLabel: r.zoneName || r.visitorName || r.id,
                            sourceKey: KEY,
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
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
          <RegisterListPagingFooter
            hasMore={listPg.hasMore(liveItems)}
            remaining={listPg.remaining(liveItems)}
            showing={Math.min(listPg.cap, liveItems.length)}
            total={liveItems.length}
            onShowMore={listPg.showMore}
            buttonStyle={ss.btn}
          />
        </div>
      )}

      </RegisterModuleShell>    </div>
  );
}
