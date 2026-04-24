import { useEffect, useMemo, useRef, useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save, orgScopedKey } from "../utils/orgStorage";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const INCIDENTS_KEY = "mysafeops_incidents";
const LEGACY_INCIDENT_KEY = "incident_register";
const ACTIONS_KEY = "incident_actions_v1";

/** Single source of truth for dashboard, client portal, and reports; migrates legacy key once. */
function loadIncidentsMerged() {
  const primary = load(INCIDENTS_KEY, []);
  const legacy = load(LEGACY_INCIDENT_KEY, []);
  const list = Array.isArray(primary) ? primary : [];
  if (!legacy.length) return list;
  const legacyList = Array.isArray(legacy) ? legacy : [];
  const seen = new Set(list.map((x) => x.id));
  const merged = [...list];
  for (const row of legacyList) {
    if (row?.id && !seen.has(row.id)) {
      merged.push(row);
      seen.add(row.id);
    }
  }
  save(INCIDENTS_KEY, merged);
  localStorage.removeItem(orgScopedKey(LEGACY_INCIDENT_KEY));
  return merged;
}

const genId = () => `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

const TYPES = [
  { id: "near_miss", label: "Near miss" },
  { id: "incident", label: "Incident" },
];

const SEVERITY = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

const STATUS = [
  { id: "open", label: "Open" },
  { id: "investigating", label: "Investigating" },
  { id: "closed", label: "Closed" },
];

function buildActionFromIncident(incident) {
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: `Follow-up: ${(incident?.location || incident?.type || "incident").toString().slice(0, 64)}`,
    owner: String(incident?.reportedBy || "").trim() || "Assign owner",
    dueDate: "",
    priority: incident?.severity === "critical" || incident?.severity === "high" ? "high" : "medium",
    status: "open",
    sourceType: "incident",
    sourceId: incident?.id || "",
    sourceLabel: `${incident?.type || "incident"} · ${incident?.location || "no location"} · ${String(incident?.description || "").slice(0, 48)}`,
    sourceProjectName: incident?.projectName || "",
    correctiveAction: "",
    verificationNote: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const QUICK_FLAGS = [
  { id: "slip_trip", label: "Slip / trip" },
  { id: "vehicle", label: "Vehicle / plant" },
  { id: "work_height", label: "Work at height" },
  { id: "electrical", label: "Electrical" },
  { id: "manual_handling", label: "Manual handling" },
  { id: "ppe", label: "PPE non-compliance" },
];
const QUICK_FLAG_LABEL = Object.fromEntries(QUICK_FLAGS.map((x) => [x.id, x.label]));

function buildQuickSummary(flags = [], note = "") {
  const labels = flags.map((id) => QUICK_FLAG_LABEL[id] || id);
  const prefix = labels.length ? `Quick tags: ${labels.join(", ")}.` : "";
  const cleanNote = String(note || "").trim();
  if (!prefix) return cleanNote;
  if (!cleanNote) return prefix;
  return `${prefix} ${cleanNote}`;
}

function readPhotoAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ""));
    reader.onerror = () => reject(new Error("Failed to read photo"));
    reader.readAsDataURL(file);
  });
}

function getGpsFix() {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error("GPS unavailable in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude || 0),
          lng: Number(pos.coords.longitude || 0),
          accuracyM: Number(pos.coords.accuracy || 0),
          capturedAt: new Date().toISOString(),
        }),
      (err) => reject(new Error(err?.message || "Failed to capture GPS.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

function QuickIncidentCapture({ projects, onCreate }) {
  const [type, setType] = useState("near_miss");
  const [location, setLocation] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [flags, setFlags] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [gps, setGps] = useState(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const fileRef = useRef(null);

  const pm = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects]);
  const summary = buildQuickSummary(flags, quickNote);

  const toggleFlag = (id) =>
    setFlags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await readPhotoAsDataUrl(file);
      setPhotos((prev) => [url, ...prev].slice(0, 4));
    } catch {
      window.alert("Could not read photo.");
    }
  };

  const captureGps = async () => {
    setGpsBusy(true);
    setGpsError("");
    try {
      const fix = await getGpsFix();
      setGps(fix);
    } catch (err) {
      setGpsError(String(err?.message || err || "Failed to capture GPS."));
    } finally {
      setGpsBusy(false);
    }
  };

  const submit = () => {
    onCreate({
      id: genId(),
      type,
      occurredAt: new Date().toISOString().slice(0, 16),
      location: location.trim(),
      projectId,
      projectName: pm[projectId] || "",
      description: summary || "Quick report",
      quickFlags: [...flags],
      quickSummary: summary,
      severity: "medium",
      injuryInvolved: false,
      immediateActions: "",
      status: "open",
      reportedBy: reportedBy.trim(),
      photos,
      gpsLat: gps?.lat ?? null,
      gpsLng: gps?.lng ?? null,
      gpsAccuracyM: gps?.accuracyM ?? null,
      gpsCapturedAt: gps?.capturedAt ?? null,
      createdAt: new Date().toISOString(),
      quickCapture: true,
    });
    setLocation("");
    setProjectId("");
    setReportedBy("");
    setQuickNote("");
    setFlags([]);
    setPhotos([]);
    setGps(null);
    setGpsError("");
  };

  return (
    <div className="app-panel-surface" style={{ padding: 12, borderRadius: 10, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Quick report (photo + GPS)</div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <select style={ss.inp} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <input style={ss.inp} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location / area" />
        <select style={ss.inp} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Project (optional)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input style={ss.inp} value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} placeholder="Reported by" />
      </div>
      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {QUICK_FLAGS.map((f) => (
          <label key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 8px", borderRadius: 16, border: "0.5px solid var(--color-border-secondary,#ccc)", background: flags.includes(f.id) ? "#E1F5EE" : "var(--color-background-primary,#fff)" }}>
            <input type="checkbox" checked={flags.includes(f.id)} onChange={() => toggleFlag(f.id)} />
            {f.label}
          </label>
        ))}
      </div>
      <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical", marginTop: 8 }} value={quickNote} onChange={(e) => setQuickNote(e.target.value)} placeholder="Quick note (optional)" />
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>Auto summary: {summary || "—"}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        <button type="button" style={ss.btn} onClick={() => fileRef.current?.click()}>
          + Photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={addPhoto} />
        <button type="button" style={ss.btn} onClick={captureGps} disabled={gpsBusy}>
          {gpsBusy ? "Capturing GPS…" : gps ? "Refresh GPS" : "Add GPS"}
        </button>
        <button type="button" style={{ ...ss.btnP, opacity: summary || location.trim() || photos.length ? 1 : 0.5 }} disabled={!(summary || location.trim() || photos.length)} onClick={submit}>
          Save quick report
        </button>
      </div>
      {gpsError ? <div style={{ marginTop: 6, fontSize: 12, color: "#A32D2D" }}>{gpsError}</div> : null}
      {gps ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
          GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} (±{Math.round(gps.accuracyM || 0)}m)
        </div>
      ) : null}
      {photos.length > 0 ? (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {photos.map((p, i) => (
            <img key={`${p.slice(0, 24)}_${i}`} src={p} alt={`quick-report-${i + 1}`} style={{ width: 66, height: 66, objectFit: "cover", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IncidentForm({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        type: "near_miss",
        occurredAt: `${today()}T12:00`,
        location: "",
        projectId: "",
        description: "",
        severity: "medium",
        injuryInvolved: false,
        immediateActions: "",
        status: "open",
        reportedBy: "",
        quickFlags: [],
        quickSummary: "",
        photos: [],
        gpsLat: null,
        gpsLng: null,
        gpsAccuracyM: null,
        gpsCapturedAt: null,
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const photoRef = useRef(null);

  const toggleQuickFlag = (id) =>
    setForm((f) => {
      const flags = Array.isArray(f.quickFlags) ? f.quickFlags : [];
      return {
        ...f,
        quickFlags: flags.includes(id) ? flags.filter((x) => x !== id) : [...flags, id],
      };
    });

  const addPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await readPhotoAsDataUrl(file);
      setForm((f) => ({ ...f, photos: [url, ...(Array.isArray(f.photos) ? f.photos : [])].slice(0, 6) }));
    } catch {
      window.alert("Could not read photo.");
    }
  };

  const captureGps = async () => {
    setGpsBusy(true);
    setGpsError("");
    try {
      const fix = await getGpsFix();
      setForm((f) => ({
        ...f,
        gpsLat: fix.lat,
        gpsLng: fix.lng,
        gpsAccuracyM: fix.accuracyM,
        gpsCapturedAt: fix.capturedAt,
      }));
    } catch (err) {
      setGpsError(String(err?.message || err || "Failed to capture GPS."));
    } finally {
      setGpsBusy(false);
    }
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
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>{item ? "Edit record" : "New incident / near miss"}</h2>
        <label style={ss.lbl}>Type</label>
        <select style={ss.inp} value={form.type} onChange={(e) => set("type", e.target.value)}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date & time</label>
        <input type="datetime-local" style={ss.inp} value={form.occurredAt} onChange={(e) => set("occurredAt", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Location / area</label>
        <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Scaffold bay 3" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project (optional)</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Description</label>
        <textarea
          style={{ ...ss.inp, minHeight: 88, resize: "vertical" }}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What happened?"
        />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Quick tags</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {QUICK_FLAGS.map((f) => {
            const selected = (form.quickFlags || []).includes(f.id);
            return (
              <label
                key={f.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 16,
                  border: "0.5px solid var(--color-border-secondary,#ccc)",
                  background: selected ? "#E1F5EE" : "var(--color-background-primary,#fff)",
                }}
              >
                <input type="checkbox" checked={selected} onChange={() => toggleQuickFlag(f.id)} />
                {f.label}
              </label>
            );
          })}
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Quick summary</label>
        <input
          style={ss.inp}
          value={form.quickSummary || ""}
          onChange={(e) => set("quickSummary", e.target.value)}
          placeholder={buildQuickSummary(form.quickFlags || [], "") || "Auto-generated from quick tags"}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Severity</label>
            <select style={ss.inp} value={form.severity} onChange={(e) => set("severity", e.target.value)}>
              {SEVERITY.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Status</label>
            <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13 }}>
          <input type="checkbox" checked={form.injuryInvolved} onChange={(e) => set("injuryInvolved", e.target.checked)} />
          Injury or ill-health involved
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Immediate actions taken</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.immediateActions} onChange={(e) => set("immediateActions", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Reported by</label>
        <input style={ss.inp} value={form.reportedBy} onChange={(e) => set("reportedBy", e.target.value)} placeholder="Name / role" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Photo evidence</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={ss.btn} onClick={() => photoRef.current?.click()}>
            {Array.isArray(form.photos) && form.photos.length ? "Add another photo" : "Add photo"}
          </button>
          <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={addPhoto} />
          <button type="button" style={ss.btn} onClick={captureGps} disabled={gpsBusy}>
            {gpsBusy ? "Capturing GPS…" : form.gpsLat && form.gpsLng ? "Refresh GPS" : "Add GPS"}
          </button>
          {form.gpsLat && form.gpsLng ? (
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {Number(form.gpsLat).toFixed(6)}, {Number(form.gpsLng).toFixed(6)} (±{Math.round(Number(form.gpsAccuracyM || 0))}m)
            </span>
          ) : null}
        </div>
        {gpsError ? <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 6 }}>{gpsError}</div> : null}
        {Array.isArray(form.photos) && form.photos.length > 0 ? (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {form.photos.map((p, idx) => (
              <div key={`${p.slice(0, 20)}_${idx}`} style={{ position: "relative" }}>
                <img src={p} alt={`incident-photo-${idx + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }} />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, photos: (f.photos || []).filter((_, i) => i !== idx) }))}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: "0.5px solid #f5c7c7", background: "#fff", color: "#A32D2D", cursor: "pointer", fontSize: 11, lineHeight: "16px", padding: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={ss.btnP}
            onClick={() =>
              onSave({
                ...form,
                description: String(form.description || "").trim() || buildQuickSummary(form.quickFlags || [], form.quickSummary || ""),
                projectName: pm[form.projectId] || "",
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentNearMiss() {
  const { caps } = useApp();
  const [items, setItems] = useState(loadIncidentsMerged);
  const [actions, setActions] = useState(() => load(ACTIONS_KEY, []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [workers, setWorkers] = useState(() => load("mysafeops_workers", []));
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState("all");
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1IncH, d1OutboxPending: d1IncO } = useD1OrgArraySync({
    storageKey: INCIDENTS_KEY,
    namespace: INCIDENTS_KEY,
    value: items,
    setValue: setItems,
    load,
    save,
  });
  const { d1Hydrating: d1ActH, d1OutboxPending: d1ActO } = useD1OrgArraySync({
    storageKey: ACTIONS_KEY,
    namespace: ACTIONS_KEY,
    value: actions,
    setValue: setActions,
    load,
    save,
  });
  const { d1Hydrating: d1WpH, d1OutboxPending: d1WpO } = useD1WorkersProjectsSync({
    workers,
    setWorkers,
    projects,
    setProjects,
    load,
    save,
  });
  const d1Hydrating = d1IncH || d1ActH || d1WpH;
  const d1OutboxPending = d1IncO || d1ActO || d1WpO;

  useEffect(() => {
    listPg.reset();
  }, [filter]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((x) => x.type === filter);
  }, [items, filter]);

  const labelType = (id) => TYPES.find((t) => t.id === id)?.label || id;
  const labelSev = (id) => SEVERITY.find((s) => s.id === id)?.label || id;
  const labelSt = (id) => STATUS.find((s) => s.id === id)?.label || id;
  const actionCountByIncident = useMemo(() => {
    const map = {};
    (actions || []).forEach((a) => {
      if (!a?.sourceId) return;
      map[a.sourceId] = (map[a.sourceId] || 0) + 1;
    });
    return map;
  }, [actions]);

  const exportCsv = () => {
    const header = ["Type", "Date/time", "Location", "Project", "Severity", "Status", "Injury", "Reported by", "Description", "Quick tags", "GPS", "Photo count"];
    const rows = items.map((r) => [
      labelType(r.type),
      r.occurredAt?.replace("T", " ") || "",
      r.location,
      r.projectName || "",
      labelSev(r.severity),
      labelSt(r.status),
      r.injuryInvolved ? "yes" : "no",
      r.reportedBy,
      r.description,
      Array.isArray(r.quickFlags) ? r.quickFlags.map((id) => QUICK_FLAG_LABEL[id] || id).join(" | ") : "",
      r.gpsLat && r.gpsLng ? `${Number(r.gpsLat).toFixed(6)},${Number(r.gpsLng).toFixed(6)}` : "",
      Array.isArray(r.photos) ? r.photos.length : 0,
    ]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `incidents_near_miss_${today()}.csv`;
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
    pushAudit({
      action: isNew ? "incident_create" : "incident_update",
      entity: "incident",
      detail: `${f.type} ${f.id}`,
    });
    setModal(null);
  };

  const escalateNearMissToIncident = (row) => {
    if (!row || row.type !== "near_miss") return;
    if (!window.confirm("Escalate this near miss to Incident and set status to Investigating?")) return;
    setItems((prev) =>
      prev.map((x) => {
        if (x.id !== row.id) return x;
        const escalated = {
          ...x,
          type: "incident",
          status: x.status === "closed" ? "closed" : "investigating",
          escalatedFromNearMissAt: new Date().toISOString(),
          description: String(x.description || "").includes("Escalated from near miss")
            ? x.description
            : `Escalated from near miss. ${x.description || ""}`.trim(),
        };
        return escalated;
      })
    );
    pushAudit({ action: "incident_escalate_from_near_miss", entity: "incident", detail: row.id });
  };

  const createActionFromIncident = (incident) => {
    const existingOpen = (actions || []).some((a) => a.sourceId === incident.id && a.status !== "closed");
    if (existingOpen) {
      window.alert("Open action already exists for this incident.");
      return;
    }
    const next = [buildActionFromIncident(incident), ...(actions || [])];
    setActions(next);
    pushAudit({ action: "incident_action_create", entity: "incident_action", detail: incident.id });
    window.alert("Incident action created. Open Incident Action Tracker to assign and set due date.");
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="incidents and lists" />
      {modal?.type === "form" && (
        <IncidentForm
          item={modal.data}
          projects={projects}
          onSave={(f) => persist(f, !modal.data)}
          onClose={() => setModal(null)}
        />
      )}
      <PageHero
        badgeText="INC"
        title="Incidents & near miss"
        lead="Site log for events and near misses. Use the RIDDOR module if a reportable incident may apply. Stored only on this device."
        right={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
      <QuickIncidentCapture
        projects={projects}
        onCreate={(f) => persist(f, true)}
      />
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Show:</span>
        {["all", "near_miss", "incident"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            style={{
              ...ss.btn,
              background: filter === k ? "#E1F5EE" : ss.btn.background,
              borderColor: filter === k ? "#0d9488" : undefined,
            }}
          >
            {k === "all" ? "All" : labelType(k)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No records match this filter.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(filtered) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, filtered.length)} of {filtered.length} records
            </div>
          ) : null}
          {listPg.visible(filtered).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 120px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{labelType(r.type)}</strong>
                  <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}> · {labelSev(r.severity)} · {labelSt(r.status)}</span>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                    {r.occurredAt?.replace("T", " ")} {r.location ? `· ${r.location}` : ""}
                    {r.projectName ? ` · ${r.projectName}` : ""}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>{r.description?.slice(0, 200) || "—"}</div>
                  {Array.isArray(r.quickFlags) && r.quickFlags.length > 0 ? (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.quickFlags.map((flag) => (
                        <span key={`${r.id}_${flag}`} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 14, background: "#E1F5EE", color: "#0C5E50" }}>
                          {QUICK_FLAG_LABEL[flag] || flag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {r.gpsLat && r.gpsLng ? (
                    <div style={{ fontSize: 12, color: "#0C447C", marginTop: 4 }}>
                      GPS: {Number(r.gpsLat).toFixed(6)}, {Number(r.gpsLng).toFixed(6)}
                      {r.gpsAccuracyM ? ` (±${Math.round(Number(r.gpsAccuracyM))}m)` : ""}
                    </div>
                  ) : null}
                  {Array.isArray(r.photos) && r.photos.length > 0 ? (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.photos.slice(0, 3).map((p, idx) => (
                        <img key={`${r.id}_photo_${idx}`} src={p} alt={`incident-${r.id}-photo-${idx + 1}`} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }} />
                      ))}
                      {r.photos.length > 3 ? (
                        <div style={{ width: 70, height: 70, borderRadius: 6, border: "0.5px dashed var(--color-border-secondary,#ccc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>
                          +{r.photos.length - 3}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {r.injuryInvolved && (
                    <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 4 }}>Injury / ill-health noted — consider RIDDOR.</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    Edit
                  </button>
                  {r.type === "near_miss" && (
                    <button type="button" style={ss.btn} onClick={() => escalateNearMissToIncident(r)}>
                      Escalate to incident
                    </button>
                  )}
                  <button type="button" style={ss.btn} onClick={() => createActionFromIncident(r)}>
                    {actionCountByIncident[r.id] ? `Actions (${actionCountByIncident[r.id]})` : "Create action"}
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (confirm("Delete this record?")) {
                          setItems((p) => p.filter((x) => x.id !== r.id));
                          pushAudit({ action: "incident_delete", entity: "incident", detail: r.id });
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
          {listPg.hasMore(filtered) ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(filtered)} remaining)
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
