import { useEffect, useMemo, useState } from "react";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { pushRecycleBinItem } from "../utils/recycleBin";
import PageHero from "../components/PageHero";

const ACTIONS_KEY = "incident_actions_v1";
const INCIDENTS_KEY = "mysafeops_incidents";
const INSPECTIONS_KEY = "inspection_records";
const PERMITS_KEY = "permits_v2";
const PROJECTS_KEY = "mysafeops_projects";

const genId = () => `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toISOString().slice(0, 10);
const ss = ms;

const STATUS = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "closed", label: "Closed" },
];

const PRIORITY = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

const REMINDER_LEAD_DAYS = 2;

function daysToDue(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(`${dueDate}T23:59:59`);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ActionForm({ item, incidents, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        title: "",
        owner: "",
        dueDate: "",
        priority: "medium",
        status: "open",
        sourceType: "incident",
        sourceId: "",
        sourceLabel: "",
        sourceProjectName: "",
        correctiveAction: "",
        verificationNote: "",
        createdAt: new Date().toISOString(),
      }
  );

  const incidentById = useMemo(() => Object.fromEntries(incidents.map((x) => [x.id, x])), [incidents]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ minHeight: 600, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 620 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>{item ? "Edit incident action" : "New incident action"}</h2>
        <label style={ss.lbl}>Action title *</label>
        <input style={ss.inp} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Install physical barrier at loading bay edge" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Owner *</label>
            <input style={ss.inp} value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Person or role" />
          </div>
          <div>
            <label style={ss.lbl}>Due date</label>
            <input type="date" style={ss.inp} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Priority</label>
            <select style={ss.inp} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {PRIORITY.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Status</label>
            <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Linked incident (optional)</label>
        <select
          style={ss.inp}
          value={form.sourceId}
          onChange={(e) => {
            const sourceId = e.target.value;
            const ref = incidentById[sourceId];
            setForm((f) => ({
              ...f,
              sourceType: "incident",
              sourceId,
              sourceLabel: ref ? `${ref.type || "incident"} · ${ref.location || "no location"} · ${String(ref.description || "").slice(0, 48)}` : "",
              sourceProjectName: ref?.projectName || "",
            }));
          }}
        >
          <option value="">— none —</option>
          {incidents.map((inc) => (
            <option key={inc.id} value={inc.id}>
              {(inc.type || "incident").replace("_", " ")} · {inc.location || "no location"} · {String(inc.description || "").slice(0, 48)}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Corrective action details</label>
        <textarea style={{ ...ss.inp, minHeight: 84, resize: "vertical" }} value={form.correctiveAction} onChange={(e) => set("correctiveAction", e.target.value)} placeholder="What exactly should be changed on site/process?" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Verification note</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.verificationNote} onChange={(e) => set("verificationNote", e.target.value)} placeholder="How closure will be verified (evidence/photo/inspection)." />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...ss.btnP, opacity: form.title.trim() && form.owner.trim() ? 1 : 0.5 }}
            disabled={!form.title.trim() || !form.owner.trim()}
            onClick={() => onSave({ ...form, updatedAt: new Date().toISOString() })}
          >
            Save action
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentActionTracker() {
  const [items, setItems] = useState(() => load(ACTIONS_KEY, []));
  const [incidents] = useState(() => load(INCIDENTS_KEY, []));
  const [inspections] = useState(() => load(INSPECTIONS_KEY, []));
  const [permits] = useState(() => load(PERMITS_KEY, []));
  const [projects] = useState(() => load(PROJECTS_KEY, []));
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  useEffect(() => {
    save(ACTIONS_KEY, items);
  }, [items]);

  const owners = useMemo(() => Array.from(new Set(items.map((x) => String(x.owner || "").trim()).filter(Boolean))).sort(), [items]);

  const filtered = useMemo(
    () =>
      items.filter((x) => {
        if (statusFilter && x.status !== statusFilter) return false;
        if (ownerFilter && x.owner !== ownerFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          String(x.title || "").toLowerCase().includes(q) ||
          String(x.correctiveAction || "").toLowerCase().includes(q) ||
          String(x.sourceLabel || "").toLowerCase().includes(q)
        );
      }),
    [items, search, statusFilter, ownerFilter]
  );

  const stats = useMemo(() => {
    const openLike = items.filter((x) => x.status !== "closed");
    const overdue = openLike.filter((x) => {
      const d = daysToDue(x.dueDate);
      return d !== null && d < 0;
    }).length;
    const due7 = openLike.filter((x) => {
      const d = daysToDue(x.dueDate);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    return {
      total: items.length,
      open: openLike.length,
      overdue,
      due7,
      closed: items.filter((x) => x.status === "closed").length,
    };
  }, [items]);

  const reminders = useMemo(
    () =>
      items
        .filter((x) => x.status !== "closed")
        .map((x) => ({ row: x, days: daysToDue(x.dueDate) }))
        .filter((x) => x.days !== null && x.days <= REMINDER_LEAD_DAYS)
        .sort((a, b) => a.days - b.days),
    [items]
  );
  const ownerDigest = useMemo(() => {
    const digest = new Map();
    reminders.forEach(({ row, days }) => {
      const owner = String(row.owner || "Unassigned").trim() || "Unassigned";
      const current = digest.get(owner) || { owner, overdue: 0, dueSoon: 0, total: 0 };
      current.total += 1;
      if (days < 0) current.overdue += 1;
      else current.dueSoon += 1;
      digest.set(owner, current);
    });
    return Array.from(digest.values()).sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }, [reminders]);
  const ownerProjectDigest = useMemo(() => {
    const digest = new Map();
    reminders.forEach(({ row, days }) => {
      const owner = String(row.owner || "Unassigned").trim() || "Unassigned";
      const project = String(row.sourceProjectName || "General").trim() || "General";
      const key = `${owner}__${project}`;
      const current = digest.get(key) || { key, owner, project, overdue: 0, dueSoon: 0, total: 0 };
      current.total += 1;
      if (days < 0) current.overdue += 1;
      else current.dueSoon += 1;
      digest.set(key, current);
    });
    return Array.from(digest.values()).sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }, [reminders]);

  const saveItem = (row) => {
    setItems((prev) => (prev.some((x) => x.id === row.id) ? prev.map((x) => (x.id === row.id ? row : x)) : [row, ...prev]));
    setModal(null);
  };

  const remove = (id) => {
    if (!window.confirm("Delete this action?")) return;
    setItems((prev) => {
      const victim = prev.find((x) => x.id === id);
      if (victim) {
        pushRecycleBinItem({
          moduleId: "incident-actions",
          moduleLabel: "Incident actions",
          itemType: "incident_action",
          itemLabel: victim.title || victim.id,
          sourceKey: ACTIONS_KEY,
          payload: victim,
        });
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  const exportCsv = () => {
    const header = ["Title", "Owner", "Status", "Priority", "Due date", "Days to due", "Linked incident", "Corrective action", "Verification"];
    const rows = filtered.map((r) => [
      r.title || "",
      r.owner || "",
      r.status || "",
      r.priority || "",
      r.dueDate || "",
      String(daysToDue(r.dueDate) ?? ""),
      r.sourceLabel || "",
      r.correctiveAction || "",
      r.verificationNote || "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `incident_actions_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pullSuggestedActions = () => {
    const existingOpen = new Set(items.filter((x) => x.status !== "closed").map((x) => `${x.sourceType || "unknown"}:${x.sourceId || ""}`));
    const created = [];

    (inspections || []).forEach((insp) => {
      if (!insp?.id) return;
      if (!["fail", "quarantine"].includes(String(insp.result || ""))) return;
      const key = `inspection:${insp.id}`;
      if (existingOpen.has(key)) return;
      created.push({
        id: genId(),
        title: `Inspection follow-up: ${insp.name || insp.serialNo || "equipment item"}`,
        owner: String(insp.inspectedBy || "").trim() || "Assign owner",
        dueDate: "",
        priority: "high",
        status: "open",
        sourceType: "inspection",
        sourceId: insp.id,
        sourceLabel: `inspection · ${insp.type || "other"} · ${insp.location || "no location"}`,
        sourceProjectName: projects.find((p) => p.id === insp.projectId)?.name || "",
        correctiveAction: `Resolve failed/quarantine inspection result (${insp.result}).`,
        verificationNote: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      existingOpen.add(key);
    });

    (permits || []).forEach((p) => {
      if (!p?.id) return;
      const status = String(p.status || "");
      if (status !== "expired" && status !== "suspended") return;
      const key = `permit:${p.id}`;
      if (existingOpen.has(key)) return;
      created.push({
        id: genId(),
        title: `Permit follow-up: ${p.description || p.location || p.id}`,
        owner: String(p.issuedBy || "").trim() || "Assign owner",
        dueDate: "",
        priority: status === "suspended" ? "high" : "medium",
        status: "open",
        sourceType: "permit",
        sourceId: p.id,
        sourceLabel: `permit · ${p.type || "general"} · ${p.location || "no location"} · ${status}`,
        sourceProjectName: projects.find((x) => x.id === p.projectId)?.name || "",
        correctiveAction: status === "suspended" ? "Investigate suspension cause and define reactivation controls." : "Review expired permit and confirm close-out / reissue decision.",
        verificationNote: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      existingOpen.add(key);
    });

    if (!created.length) {
      window.alert("No new suggested actions from inspections/permits.");
      return;
    }
    setItems((prev) => [...created, ...prev]);
    window.alert(`Created ${created.length} suggested action(s).`);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", color: "var(--color-text-primary)" }}>
      {modal && <ActionForm item={modal.item} incidents={incidents} onSave={saveItem} onClose={() => setModal(null)} />}
      <PageHero
        badgeText="CAPA"
        title="Incident Action Tracker"
        lead="Corrective and preventive actions from incidents / near misses, with owners, due dates, and closure evidence."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={ss.btn} onClick={pullSuggestedActions}>
              Pull from inspections/permits
            </button>
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" style={ss.btnP} onClick={() => setModal({ item: null })}>
              + New action
            </button>
          </div>
        }
      />

      {reminders.length > 0 ? (
        <div className="app-panel-surface" style={{ padding: 10, borderRadius: 10, marginBottom: 12, background: "#FFF7ED", border: "1px solid #fed7aa" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>
            CAPA reminders: {reminders.length} action(s) overdue or due within {REMINDER_LEAD_DAYS} day(s)
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {reminders.slice(0, 5).map(({ row, days }) => (
              <div key={row.id} style={{ fontSize: 12, color: "#7c2d12" }}>
                <strong>{row.title || "Untitled"}</strong> · owner: {row.owner || "—"} · {days < 0 ? `${Math.abs(days)}d overdue` : `due in ${days}d`}
              </div>
            ))}
          </div>
          {ownerDigest.length > 0 ? (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #fdba74", display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, color: "#9a3412", fontWeight: 700 }}>Owner escalation digest</div>
              {ownerDigest.slice(0, 6).map((d) => (
                <div key={d.owner} style={{ fontSize: 12, color: "#7c2d12" }}>
                  <strong>{d.owner}</strong> · overdue {d.overdue} · due soon {d.dueSoon}
                </div>
              ))}
            </div>
          ) : null}
          {ownerProjectDigest.length > 0 ? (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #fdba74", display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, color: "#9a3412", fontWeight: 700 }}>Owner + project digest</div>
              {ownerProjectDigest.slice(0, 6).map((d) => (
                <div key={d.key} style={{ fontSize: 12, color: "#7c2d12" }}>
                  <strong>{d.owner}</strong> · {d.project} · overdue {d.overdue} · due soon {d.dueSoon}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Total", value: stats.total, bg: "var(--color-background-secondary,#f7f7f5)", color: "var(--color-text-primary)" },
          { label: "Open", value: stats.open, bg: "#FAEEDA", color: "#633806" },
          { label: "Due in 7d", value: stats.due7, bg: "#E6F1FB", color: "#0C447C" },
          { label: "Overdue", value: stats.overdue, bg: "#FCEBEB", color: "#791F1F" },
          { label: "Closed", value: stats.closed, bg: "#EAF3DE", color: "#27500A" },
        ].map((x) => (
          <div key={x.label} className="app-panel-surface" style={{ padding: "10px 12px", borderRadius: 10, background: x.bg }}>
            <div style={{ fontSize: 11, color: x.color }}>{x.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: x.color }}>{x.value}</div>
          </div>
        ))}
      </div>

      <div className="app-panel-surface" style={{ padding: 12, borderRadius: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          <input style={ss.inp} placeholder="Search title/action/incident…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={ss.inp} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <select style={ss.inp} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">All owners</option>
            {owners.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No actions found.</div>
          ) : (
            filtered.map((row) => {
              const d = daysToDue(row.dueDate);
              const dueTone = row.status === "closed" ? "#64748b" : d == null ? "#64748b" : d < 0 ? "#b91c1c" : d <= 7 ? "#92400e" : "#1d4ed8";
              return (
                <div key={row.id} className="app-surface-card" style={{ ...ss.card, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{row.title || "Untitled action"}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Owner: {row.owner || "—"} · Priority: {row.priority || "—"} · Status: {row.status || "—"}
                      </div>
                      {row.sourceLabel ? <div style={{ marginTop: 2, fontSize: 11, color: "#0C447C" }}>Linked incident: {row.sourceLabel}</div> : null}
                    </div>
                    <div style={{ textAlign: "right", minWidth: 132 }}>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Due: {row.dueDate || "—"}</div>
                      <div style={{ fontSize: 12, color: dueTone, fontWeight: 600 }}>
                        {row.status === "closed" ? "Closed" : d == null ? "No due date" : d < 0 ? `${Math.abs(d)}d overdue` : `Due in ${d}d`}
                      </div>
                    </div>
                  </div>
                  {row.correctiveAction ? <div style={{ marginTop: 8, fontSize: 12 }}>Action: {row.correctiveAction}</div> : null}
                  {row.verificationNote ? <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>Verification: {row.verificationNote}</div> : null}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" style={ss.btn} onClick={() => setModal({ item: row })}>
                      Edit
                    </button>
                    {row.status !== "closed" ? (
                      <button
                        type="button"
                        style={ss.btnP}
                        onClick={() => saveItem({ ...row, status: "closed", updatedAt: new Date().toISOString() })}
                      >
                        Mark closed
                      </button>
                    ) : null}
                    <button type="button" style={{ ...ss.btn, color: "#A32D2D", borderColor: "#F09595" }} onClick={() => remove(row.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

