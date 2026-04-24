import { useCallback, useMemo, useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { orgHasFoodIndustrialPack } from "../utils/industrialSectors";

const STORAGE_KEY = "loto_register";
const genId = () => `loto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const genIsoId = () => `iso_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

const ISOLATION_TYPES = ["electrical", "pneumatic", "hydraulic", "steam", "process", "thermal"];

/** @param {any} raw */
function migrateToWorkflow(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw.isolationPoints)) return { ...raw };

  const locked = raw.status === "removed" ? false : raw.status === "locked";
  return {
    id: raw.id || genId(),
    equipmentName: raw.equipmentId || "",
    equipmentTag: "",
    projectId: raw.projectId || "",
    projectName: raw.projectName || "",
    phase: raw.status === "removed" ? "closed" : locked ? "live" : "draft",
    isolationPoints: raw.isolationPoint
      ? [
          {
            id: genIsoId(),
            type: "electrical",
            description: String(raw.isolationPoint),
            lockNumber: "",
            tagNumber: "",
            lockedBy: raw.appliedBy || "",
            lockedAt: raw.appliedDate ? new Date(raw.appliedDate + "T12:00:00").getTime() : null,
            verifiedBy: "",
            verifiedAt: null,
            unlockedBy: raw.removedBy || "",
            unlockedAt: raw.removedDate ? new Date(raw.removedDate + "T12:00:00").getTime() : null,
          },
        ]
      : [],
    zeroEnergyVerified: Boolean(locked),
    zeroEnergyMethod: "",
    zeroEnergyVerifiedBy: "",
    linkedHotWorkIds: [],
    notes: raw.notes || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function isolationComplete(points) {
  if (!points.length) return false;
  return points.every(
    (p) =>
      p.description?.trim() &&
      p.lockedBy?.trim() &&
      p.lockedAt &&
      p.verifiedBy?.trim() &&
      p.verifiedAt &&
      String(p.verifiedBy).trim().toLowerCase() !== String(p.lockedBy).trim().toLowerCase()
  );
}

function phaseLabel(phase) {
  const m = {
    draft: "Planning",
    isolations_locked: "Locks applied",
    verified: "Independently verified",
    zero_energy: "Zero energy",
    live: "Authorised — live isolation",
    removal: "Removal in progress",
    closed: "Closed / cleared",
  };
  return m[phase] || phase;
}

function DetailModal({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(() => migrateToWorkflow(item) || {});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const addPoint = () => {
    set("isolationPoints", [
      ...(form.isolationPoints || []),
      {
        id: genIsoId(),
        type: "electrical",
        description: "",
        lockNumber: "",
        tagNumber: "",
        lockedBy: "",
        lockedAt: null,
        verifiedBy: "",
        verifiedAt: null,
        unlockedBy: "",
        unlockedAt: null,
      },
    ]);
  };

  const patchPoint = (id, patch) => {
    set(
      "isolationPoints",
      (form.isolationPoints || []).map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const setPhase = (next) => set("phase", next);

  const advance = () => {
    const pts = form.isolationPoints || [];
    if (form.phase === "draft") {
      if (!form.equipmentName?.trim()) {
        alert("Enter equipment name or tag.");
        return;
      }
      if (!pts.length) {
        alert("Add at least one isolation point.");
        return;
      }
      const locksOk = pts.every((p) => p.description?.trim() && p.lockedBy?.trim() && p.lockedAt);
      if (!locksOk) {
        alert("Each isolation point needs description, locked by, and lock time.");
        return;
      }
      setPhase("isolations_locked");
      return;
    }
    if (form.phase === "isolations_locked") {
      if (!isolationComplete(pts)) {
        alert("4-eyes: each point must be verified by a different competent person than who applied the lock.");
        return;
      }
      setPhase("verified");
      return;
    }
    if (form.phase === "verified") {
      if (!form.zeroEnergyVerified) {
        alert("Confirm zero-energy verification before authorising.");
        return;
      }
      if (!String(form.zeroEnergyMethod || "").trim()) {
        alert("Describe how zero energy was proved (e.g. attempted start, pressure bled).");
        return;
      }
      if (!String(form.zeroEnergyVerifiedBy || "").trim()) {
        alert("Enter who signed off zero-energy check.");
        return;
      }
      setPhase("zero_energy");
      return;
    }
    if (form.phase === "zero_energy") {
      setPhase("live");
      return;
    }
    if (form.phase === "live") {
      if (!window.confirm("Mark LOTO as removal started? Ensure removal follows your site procedure.")) return;
      setPhase("removal");
      return;
    }
    if (form.phase === "removal") {
      const now = Date.now();
      const nextPts = pts.map((p) => ({
        ...p,
        unlockedBy: p.unlockedBy || form.removalSignedBy || "",
        unlockedAt: p.unlockedAt || now,
      }));
      set("isolationPoints", nextPts);
      setPhase("closed");
    }
  };

  const foodPack = orgHasFoodIndustrialPack();

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
      <div style={{ ...ss.card, width: "100%", maxWidth: 720, marginTop: 16, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "LOTO workflow" : "New LOTO workflow"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0 }}>
          Lock → independent verification → zero-energy proof → authorise. Hot work in food environments should link to a live LOTO on the same equipment.
        </p>

        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#E6F1FB", fontSize: 12, marginBottom: 14 }}>
          <strong>Phase:</strong> {phaseLabel(form.phase || "draft")}
        </div>

        <label style={ss.lbl}>Equipment name</label>
        <input style={ss.inp} value={form.equipmentName || ""} onChange={(e) => set("equipmentName", e.target.value)} placeholder="e.g. CIP skid 3" />

        <label style={{ ...ss.lbl, marginTop: 10 }}>Equipment tag / ID</label>
        <input style={ss.inp} value={form.equipmentTag || ""} onChange={(e) => set("equipmentTag", e.target.value)} placeholder="e.g. CIP-03" />

        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId || ""} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 16, fontWeight: 600, fontSize: 13 }}>Isolation points</div>
        <button type="button" style={{ ...ss.btn, marginTop: 8 }} onClick={addPoint}>
          + Add isolation point
        </button>
        {(form.isolationPoints || []).map((p) => (
          <div
            key={p.id}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--color-border-tertiary,#e5e5e5)",
              background: "var(--color-background-secondary,#f8fafc)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
              <div>
                <label style={ss.lbl}>Type</label>
                <select style={ss.inp} value={p.type} onChange={(e) => patchPoint(p.id, { type: e.target.value })}>
                  {ISOLATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl}>Description / location</label>
                <input style={ss.inp} value={p.description} onChange={(e) => patchPoint(p.id, { description: e.target.value })} />
              </div>
              <div>
                <label style={ss.lbl}>Lock number</label>
                <input style={ss.inp} value={p.lockNumber} onChange={(e) => patchPoint(p.id, { lockNumber: e.target.value })} />
              </div>
              <div>
                <label style={ss.lbl}>Tag number</label>
                <input style={ss.inp} value={p.tagNumber} onChange={(e) => patchPoint(p.id, { tagNumber: e.target.value })} />
              </div>
              <div>
                <label style={ss.lbl}>Locked by</label>
                <input style={ss.inp} value={p.lockedBy} onChange={(e) => patchPoint(p.id, { lockedBy: e.target.value })} />
              </div>
              <div>
                <label style={ss.lbl}>Locked at</label>
                <input
                  type="datetime-local"
                  style={ss.inp}
                  value={p.lockedAt ? new Date(p.lockedAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    patchPoint(p.id, { lockedAt: v ? new Date(v).getTime() : null });
                  }}
                />
              </div>
              <div>
                <label style={ss.lbl}>Verified by (4-eyes)</label>
                <input style={ss.inp} value={p.verifiedBy} onChange={(e) => patchPoint(p.id, { verifiedBy: e.target.value })} />
              </div>
              <div>
                <label style={ss.lbl}>Verified at</label>
                <input
                  type="datetime-local"
                  style={ss.inp}
                  value={p.verifiedAt ? new Date(p.verifiedAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    patchPoint(p.id, { verifiedAt: v ? new Date(v).getTime() : null });
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: "1px solid #FDE68A", background: "#FFFBEB" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Zero energy verification</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={!!form.zeroEnergyVerified} onChange={(e) => set("zeroEnergyVerified", e.target.checked)} />
            Zero energy / stored energy released and proven
          </label>
          <label style={{ ...ss.lbl, marginTop: 8 }}>Method (how proved)</label>
          <textarea style={{ ...ss.inp, minHeight: 44 }} value={form.zeroEnergyMethod || ""} onChange={(e) => set("zeroEnergyMethod", e.target.value)} />
          <label style={{ ...ss.lbl, marginTop: 8 }}>Signed off by</label>
          <input style={ss.inp} value={form.zeroEnergyVerifiedBy || ""} onChange={(e) => set("zeroEnergyVerifiedBy", e.target.value)} />
        </div>

        {foodPack && (
          <div style={{ marginTop: 14 }}>
            <label style={ss.lbl}>Linked hot work record IDs (optional refs)</label>
            <textarea
              style={{ ...ss.inp, minHeight: 36 }}
              placeholder="Comma-separated hot work register IDs for traceability"
              value={(form.linkedHotWorkIds || []).join(", ")}
              onChange={(e) =>
                set(
                  "linkedHotWorkIds",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
            />
          </div>
        )}

        <label style={{ ...ss.lbl, marginTop: 12 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 44 }} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />

        {form.phase === "removal" && (
          <div style={{ marginTop: 12 }}>
            <label style={ss.lbl}>Removal signed by (optional batch)</label>
            <input style={ss.inp} value={form.removalSignedBy || ""} onChange={(e) => set("removalSignedBy", e.target.value)} />
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginTop: 18 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {form.phase !== "closed" && (
              <button type="button" style={ss.btnP} onClick={advance}>
                {form.phase === "draft" && "Locks applied →"}
                {form.phase === "isolations_locked" && "Verification complete →"}
                {form.phase === "verified" && "Zero energy recorded →"}
                {form.phase === "zero_energy" && "Authorise (live) →"}
                {form.phase === "live" && "Start removal →"}
                {form.phase === "removal" && "Close LOTO"}
              </button>
            )}
            <button
              type="button"
              style={ss.btnP}
              onClick={() =>
                onSave({
                  ...form,
                  projectName: pm[form.projectId] || "",
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function getAuthorisedLiveLotoList(items) {
  return (items || []).filter((r) => (r.phase || "draft") === "live");
}

export default function LOTORegister() {
  const { caps } = useApp();
  const [items, setItemsRaw] = useState(() => {
    const raw = load(STORAGE_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(migrateToWorkflow).filter(Boolean);
  });
  /** Normalise D1 / local payloads so legacy rows always match the workflow shape. */
  const setItems = useCallback((valueOrUpdater) => {
    setItemsRaw((prev) => {
      const next = typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
      if (!Array.isArray(next)) return [];
      return next.map(migrateToWorkflow).filter(Boolean);
    });
  }, []);
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  const { d1Syncing: d1Items } = useD1OrgArraySync({
    storageKey: STORAGE_KEY,
    namespace: STORAGE_KEY,
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
  const d1Syncing = d1Items || d1Proj;

  const live = useMemo(() => items.filter((r) => r.phase === "live"), [items]);

  const exportCsv = () => {
    const h = ["Equipment", "Tag", "Phase", "Project", "Points", "Zero energy", "Updated"];
    const rows = items.map((r) => [
      r.equipmentName,
      r.equipmentTag,
      r.phase,
      r.projectName || "",
      (r.isolationPoints || []).length,
      r.zeroEnergyVerified ? "yes" : "no",
      r.updatedAt || "",
    ]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `loto_workflow_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const persist = (f, isNew) => {
    const row = { ...f, id: f.id || genId(), updatedAt: new Date().toISOString() };
    setItems((p) => {
      const i = p.findIndex((x) => x.id === row.id);
      if (i >= 0) {
        const n = [...p];
        n[i] = row;
        return n;
      }
      return [row, ...p];
    });
    pushAudit({ action: isNew ? "loto_workflow_create" : "loto_workflow_update", entity: "loto", detail: row.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {d1Syncing ? (
        <div
          className="app-panel-surface"
          style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}
        >
          Syncing LOTO workflows with cloud…
        </div>
      ) : null}
      {modal?.type === "form" && (
        <DetailModal item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />
      )}
      <PageHero
        badgeText="LOTO"
        title="LOTO workflow"
        lead="First-class isolation with 4-eyes verification and zero-energy sign-off. Link from hot work when working in food or similar sites."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {live.length > 0 && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "#DCFCE7", color: "#166534" }}>
                {live.length} live
              </span>
            )}
            {items.length > 0 && (
              <button type="button" style={ss.btn} onClick={exportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + New LOTO
            </button>
          </div>
        }
      />

      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No LOTO workflows yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(items) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, items.length)} of {items.length}
            </div>
          ) : null}
          {listPg.visible(items).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 80px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.equipmentName || "Equipment"}</strong>
                  {r.equipmentTag ? <span style={{ color: "var(--color-text-secondary)" }}> · {r.equipmentTag}</span> : null}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {phaseLabel(r.phase)} · {(r.isolationPoints || []).length} point(s) · {r.projectName || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    Open
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (confirm("Delete this LOTO workflow?")) {
                          setItems((p) => p.filter((x) => x.id !== r.id));
                          pushAudit({ action: "loto_workflow_delete", entity: "loto", detail: r.id });
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
