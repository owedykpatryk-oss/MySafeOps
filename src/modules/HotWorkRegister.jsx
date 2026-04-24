import { useEffect, useMemo, useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { orgHasFoodIndustrialPack } from "../utils/industrialSectors";
import { getAuthorisedLiveLotoList } from "./LOTORegister";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const genId = () => `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

const FOOD_ZONES = [
  { id: "ambient", label: "Ambient / low care" },
  { id: "low_risk", label: "Low risk" },
  { id: "high_risk", label: "High risk" },
  { id: "high_care", label: "High care" },
];

const PROD_STATUS = [
  { id: "running", label: "Production running" },
  { id: "changeover", label: "Changeover" },
  { id: "down", label: "Line down" },
  { id: "cip", label: "CIP / cleaning" },
];

function defaultFoodFields() {
  return {
    foodZoneClass: "high_care",
    productionStatus: "down",
    foreignBodyControls: {
      magnetCheckBefore: false,
      magnetCheckAfter: false,
      sparkContainment: "",
      debrisSheet: false,
      postWorkMetalDetector: false,
    },
    allergenControls: {
      allergensInArea: "",
      additionalPpe: "",
      cleaningBefore: false,
      cleaningAfterRequired: false,
      cleaningSignedOffBy: "",
    },
    linkedLotoId: "",
    noLotoJustification: "",
    qcSignoffRequired: true,
    qcSignedOffBy: "",
    qcSignedOffAt: null,
  };
}

function Form({ item, projects, liveLotos, onSave, onClose }) {
  const food = orgHasFoodIndustrialPack();
  const [form, setForm] = useState(() => {
    const base =
      item ||
      {
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
        ...defaultFoodFields(),
      };
    if (item && !item.foodZoneClass && food) return { ...defaultFoodFields(), ...item };
    return base;
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (parent, k, v) => setForm((f) => ({ ...f, [parent]: { ...f[parent], [k]: v } }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const handleSubmit = () => {
    if (food) {
      if (form.status === "completed" && form.qcSignoffRequired && !form.qcSignedOffAt) {
        alert("QC sign-off is required before closing this hot work record. Enter who signed off and mark the time.");
        return;
      }
      if (form.status === "active" && !form.linkedLotoId && !String(form.noLotoJustification || "").trim()) {
        alert("Link a live LOTO or enter a brief justification when hot work proceeds without LOTO on file.");
        return;
      }
    }
    onSave({ ...form, projectName: pm[form.projectId] || "" });
  };

  const markQc = () => {
    const who = window.prompt("QC / production sign-off — name or initials:");
    if (!who || !who.trim()) return;
    set("qcSignedOffBy", who.trim());
    set("qcSignedOffAt", Date.now());
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "1.5rem 1rem",
        position: "fixed",
        inset: 0,
        zIndex: 50,
        overflow: "auto",
      }}
    >
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit hot work" : "Hot work record"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>
          Align with your fire plan and PTW. Food-sector controls appear when your organisation includes food-related sectors in Settings → Sectors.
        </p>
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

        {food && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: "1px solid #BFDBFE", background: "#F0F9FF" }}>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Food environment controls</div>
            <label style={ss.lbl}>Food zone class</label>
            <select style={ss.inp} value={form.foodZoneClass || "high_care"} onChange={(e) => set("foodZoneClass", e.target.value)}>
              {FOOD_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
            <label style={{ ...ss.lbl, marginTop: 10 }}>Production status</label>
            <select style={ss.inp} value={form.productionStatus || "down"} onChange={(e) => set("productionStatus", e.target.value)}>
              {PROD_STATUS.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>

            <div style={{ fontWeight: 600, marginTop: 12, fontSize: 12 }}>Foreign body controls</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.foreignBodyControls?.magnetCheckBefore} onChange={(e) => setNested("foreignBodyControls", "magnetCheckBefore", e.target.checked)} />
              Magnet / foreign-body check before
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.foreignBodyControls?.magnetCheckAfter} onChange={(e) => setNested("foreignBodyControls", "magnetCheckAfter", e.target.checked)} />
              Magnet / check after
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.foreignBodyControls?.debrisSheet} onChange={(e) => setNested("foreignBodyControls", "debrisSheet", e.target.checked)} />
              Debris sheet deployed
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.foreignBodyControls?.postWorkMetalDetector} onChange={(e) => setNested("foreignBodyControls", "postWorkMetalDetector", e.target.checked)} />
              Post-work metal detector check required
            </label>
            <label style={{ ...ss.lbl, marginTop: 8 }}>Spark containment (e.g. welding blanket)</label>
            <input
              style={ss.inp}
              value={form.foreignBodyControls?.sparkContainment || ""}
              onChange={(e) => setNested("foreignBodyControls", "sparkContainment", e.target.value)}
            />

            <div style={{ fontWeight: 600, marginTop: 12, fontSize: 12 }}>Allergen controls</div>
            <label style={ss.lbl}>Allergens present in area (comma-separated)</label>
            <input
              style={ss.inp}
              value={form.allergenControls?.allergensInArea || ""}
              onChange={(e) => setNested("allergenControls", "allergensInArea", e.target.value)}
              placeholder="e.g. milk, gluten"
            />
            <label style={{ ...ss.lbl, marginTop: 8 }}>Additional PPE / gowning</label>
            <input
              style={ss.inp}
              value={form.allergenControls?.additionalPpe || ""}
              onChange={(e) => setNested("allergenControls", "additionalPpe", e.target.value)}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.allergenControls?.cleaningBefore} onChange={(e) => setNested("allergenControls", "cleaningBefore", e.target.checked)} />
              Area cleaning before work
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.allergenControls?.cleaningAfterRequired} onChange={(e) => setNested("allergenControls", "cleaningAfterRequired", e.target.checked)} />
              Cleaning after required before line release
            </label>

            <label style={{ ...ss.lbl, marginTop: 12 }}>Link live LOTO (interlock)</label>
            <select style={ss.inp} value={form.linkedLotoId || ""} onChange={(e) => set("linkedLotoId", e.target.value)}>
              <option value="">— None selected —</option>
              {liveLotos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.equipmentName || l.id} {l.equipmentTag ? `(${l.equipmentTag})` : ""}
                </option>
              ))}
            </select>
            <label style={{ ...ss.lbl, marginTop: 10 }}>If no LOTO — brief justification</label>
            <textarea style={{ ...ss.inp, minHeight: 44 }} value={form.noLotoJustification || ""} onChange={(e) => set("noLotoJustification", e.target.value)} />

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
              <input type="checkbox" checked={!!form.qcSignoffRequired} onChange={(e) => set("qcSignoffRequired", e.target.checked)} />
              QC / production sign-off required before closure
            </label>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6 }}>
              {form.qcSignedOffAt
                ? `Signed off by ${form.qcSignedOffBy} at ${new Date(form.qcSignedOffAt).toLocaleString()}`
                : "Not signed off yet."}
            </div>
            <button type="button" style={{ ...ss.btn, marginTop: 8 }} onClick={markQc}>
              Record QC sign-off
            </button>
          </div>
        )}

        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 44, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={handleSubmit}>
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
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [lotoSnap, setLotoSnap] = useState(() => load("loto_register", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "hot_work_register",
    namespace: "hot_work_register",
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

  useEffect(() => {
    const t = setInterval(() => setLotoSnap(load("loto_register", [])), 4000);
    return () => clearInterval(t);
  }, []);

  const liveLotos = useMemo(() => getAuthorisedLiveLotoList(lotoSnap), [lotoSnap]);

  const activeCount = items.filter((r) => r.status === "active").length;

  const exportCsv = () => {
    const h = [
      "Permit",
      "Date",
      "Location",
      "Project",
      "From",
      "To",
      "Fire watch",
      "Status",
      "Issued by",
      "LOTO",
      "QC",
    ];
    const rows = items.map((r) => [
      r.permitRef,
      r.workDate,
      r.location,
      r.projectName || "",
      r.timeFrom,
      r.timeTo,
      r.fireWatchName,
      r.status,
      r.issuedBy,
      r.linkedLotoId || "",
      r.qcSignedOffAt ? "yes" : "",
    ]);
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
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="hot work register" />
      {modal?.type === "form" && (
        <Form item={modal.data} projects={projects} liveLotos={liveLotos} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />
      )}
      <PageHero
        badgeText="HW"
        title="Hot work register"
        lead="Welding, cutting, grinding — with optional food-sector controls and LOTO interlock."
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
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {r.location} · {r.status}
                    {r.linkedLotoId ? ` · LOTO ${r.linkedLotoId.slice(-6)}` : ""}
                    {r.qcSignoffRequired && !r.qcSignedOffAt && r.status === "active" ? " · QC pending" : ""}
                  </div>
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
