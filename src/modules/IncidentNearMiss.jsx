import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save, orgScopedKey } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const INCIDENTS_KEY = "mysafeops_incidents";
const LEGACY_INCIDENT_KEY = "incident_register";

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
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

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
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    save(INCIDENTS_KEY, items);
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((x) => x.type === filter);
  }, [items, filter]);

  const labelType = (id) => TYPES.find((t) => t.id === id)?.label || id;
  const labelSev = (id) => SEVERITY.find((s) => s.id === id)?.label || id;
  const labelSt = (id) => STATUS.find((s) => s.id === id)?.label || id;

  const exportCsv = () => {
    const header = ["Type", "Date/time", "Location", "Project", "Severity", "Status", "Injury", "Reported by", "Description"];
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

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
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
          {filtered.map((r) => (
            <div key={r.id} style={ss.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{labelType(r.type)}</strong>
                  <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}> · {labelSev(r.severity)} · {labelSt(r.status)}</span>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                    {r.occurredAt?.replace("T", " ")} {r.location ? `· ${r.location}` : ""}
                    {r.projectName ? ` · ${r.projectName}` : ""}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>{r.description?.slice(0, 200) || "—"}</div>
                  {r.injuryInvolved && (
                    <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 4 }}>Injury / ill-health noted — consider RIDDOR.</div>
                  )}
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
        </div>
      )}
    </div>
  );
}
