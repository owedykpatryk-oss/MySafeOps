import { useMemo, useState } from "react";
import ModuleOverlay from "../components/ModuleOverlay";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { getOrgSettings } from "../utils/orgSettingsStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import RegisterModuleShell from "../components/RegisterModuleShell";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import StatusChip from "../components/StatusChip";
import { printExcavationRecord } from "./excavationPrintHtml";
import { exportCsv } from "../utils/exportCsv";
import { validateRequiredFields } from "../utils/registerPersistGuard";

import { todayLocalISO } from "../utils/localDate";
const genId = () => `exc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

const ss = ms;

const STATUS_META = {
  open: { label: "Open", tone: "warn", icon: "▶" },
  backfilled: { label: "Backfilled", tone: "success", icon: "✓" },
  suspended: { label: "Suspended", tone: "danger", icon: "⏸" },
};

function Field({ label, children, style }) {
  return (
    <label style={{ display: "block", minWidth: 0, ...style }}>
      <div style={{ ...ss.lbl, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function Form({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        permitRef: "",
        workDescription: "",
        maxDepth: "",
        shoringSystem: "",
        location: "",
        projectId: "",
        workDate: today(),
        utilitiesConfirmed: false,
        utilitySearchRef: "",
        banksmanName: "",
        status: "open",
        closedDate: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <ModuleOverlay onClose={onClose}>
      <div
        className="app-module-overlay__panel"
        style={{
          ...ss.card,
          maxWidth: 640,
          border: "1px solid var(--color-border-tertiary, #e2e8f0)",
          boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#0f766e", textTransform: "uppercase" }}>
              Permit-to-dig
            </div>
            <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>{item ? "Edit excavation" : "New excavation record"}</h2>
          </div>
          <StatusChip meta={STATUS_META[form.status] || STATUS_META.open} size="md" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <Field label="Permit / permit-to-dig ref">
            <input style={ss.inp} value={form.permitRef} onChange={(e) => set("permitRef", e.target.value)} placeholder="e.g. PTD-042" />
          </Field>
          <Field label="Date">
            <input type="date" style={ss.inp} value={form.workDate} onChange={(e) => set("workDate", e.target.value)} />
          </Field>
          <Field label="Status">
            <select style={ss.inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="open">Open</option>
              <option value="backfilled">Backfilled / closed</option>
              <option value="suspended">Suspended</option>
            </select>
          </Field>
          <Field label="Max depth (m)">
            <input style={ss.inp} value={form.maxDepth} onChange={(e) => set("maxDepth", e.target.value)} placeholder="e.g. 1.2" />
          </Field>
        </div>

        <Field label="Work description" style={{ marginTop: 12 }}>
          <textarea
            style={{ ...ss.inp, minHeight: 56, resize: "vertical" }}
            value={form.workDescription}
            onChange={(e) => set("workDescription", e.target.value)}
            placeholder="Trench for duct / trial pit / footing…"
          />
        </Field>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <Field label="Location on site">
            <input style={ss.inp} value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Project">
            <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Support / battering">
            <input
              style={ss.inp}
              value={form.shoringSystem}
              onChange={(e) => set("shoringSystem", e.target.value)}
              placeholder="Trench box / battered / sheet piled"
            />
          </Field>
          <Field label="Banksman / spotter">
            <input style={ss.inp} value={form.banksmanName} onChange={(e) => set("banksmanName", e.target.value)} />
          </Field>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 12,
            background: form.utilitiesConfirmed
              ? "linear-gradient(135deg, rgba(236,253,245,0.9), rgba(255,255,255,0.95))"
              : "linear-gradient(135deg, rgba(255,251,235,0.95), rgba(255,255,255,0.95))",
            border: `1px solid ${form.utilitiesConfirmed ? "#86efac" : "#fde68a"}`,
          }}
        >
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.utilitiesConfirmed}
              onChange={(e) => set("utilitiesConfirmed", e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              <strong>Underground services search / CAT scan completed</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                HSG47 / PAS 128 style check before mechanical dig
              </div>
            </span>
          </label>
          <Field label="Utility search reference" style={{ marginTop: 10 }}>
            <input
              style={ss.inp}
              value={form.utilitySearchRef}
              onChange={(e) => set("utilitySearchRef", e.target.value)}
              placeholder="Stats / Linesearch / private plans ref"
            />
          </Field>
        </div>

        <Field label="Notes" style={{ marginTop: 12 }}>
          <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const payload = { ...form, projectName: pm[form.projectId] || "" };
            const check = validateRequiredFields(payload, ["location","workDate"], { location: "Location", workDate: "Work date" });
            if (!check.ok) { window.alert(check.message); return; }
            onSave(payload);
          }}>
            Save record
          </button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

function MetaCell({ label, value, warn }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: warn ? "#b45309" : "var(--color-text)",
          marginTop: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value || "—"}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export default function ExcavationLog() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("excavation_log", []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const listPg = useRegisterListPaging(50);

  const { d1Hydrating: d1ItemsH, d1OutboxPending: d1ItemsO } = useD1OrgArraySync({
    storageKey: "excavation_log",
    namespace: "excavation_log",
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

  const filtered = useMemo(() => {
    let rows = liveItems;
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.permitRef, r.location, r.projectName, r.workDescription, r.banksmanName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return rows;
  }, [liveItems, statusFilter, search]);

  const handleExportCsv = () => {
    const h = ["Permit", "Date", "Depth", "Location", "Project", "Utilities OK", "Status", "Banksman"];
    const rows = liveItems.map((r) => [
      r.permitRef,
      r.workDate,
      r.maxDepth,
      r.location,
      r.projectName || "",
      r.utilitiesConfirmed ? "yes" : "no",
      r.status,
      r.banksmanName || "",
    ]);
    exportCsv(h, rows, `excavation_${today()}.csv`);
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
    pushAudit({ action: isNew ? "excavation_create" : "excavation_update", entity: "excavation", detail: f.id });
    setModal(null);
  };

  const runPrint = (r) => {
    const org = getOrgSettings() || {};
    printExcavationRecord(r, { orgName: org.name || "MySafeOps" });
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="excavation log" />
      {modal?.type === "form" && (
        <Form item={modal.data} projects={projects} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />
      )}
      <PageHero
        exportModuleId="excavation"
        badgeText="EX"
        title="Excavations"
        lead="Permit-to-dig style records — depth, support, utilities confirmation, and banksman. Export the register or print a single A4 record."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {liveItems.length > 0 && (
              <button type="button" style={ss.btn} onClick={handleExportCsv}>
                Export CSV
              </button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
              + Add record
            </button>
          </div>
        }
      />

      <RegisterModuleShell moduleId="excavation" smartContext={{ items: liveItems }} stats={buildRegisterModuleStats("excavation", liveItems)}>
        <div
          className="app-register-filters"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <input
            style={{ ...ss.inp, maxWidth: 260, margin: 0 }}
            placeholder="Search permit, location, project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select style={{ ...ss.inp, maxWidth: 160, margin: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="suspended">Suspended</option>
            <option value="backfilled">Backfilled</option>
          </select>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {filtered.length} of {liveItems.length} shown
          </span>
        </div>

        {liveItems.length === 0 ? (
          <EmptyState
            icon="⛏️"
            title="No excavation records yet"
            description="Log open trenches and trial pits with depth, support, and utility confirmation before dig."
            actionLabel="+ Add first record"
            onAction={() => setModal({ type: "form" })}
            variant="dashed"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No matches for this filter"
            description="Try clearing search or switching status filter to All."
            actionLabel="Clear filters"
            onAction={() => {
              setSearch("");
              setStatusFilter("all");
              listPg.reset();
            }}
            variant="dashed"
            compact
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {listPg.visible(filtered).map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.open;
              return (
                <div
                  key={r.id}
                  style={{
                    ...ss.card,
                    contentVisibility: "auto",
                    containIntrinsicSize: "0 120px",
                    border: "1px solid var(--color-border-tertiary, #e2e8f0)",
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(240,253,250,0.35) 100%)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <strong style={{ fontSize: 15 }}>{r.permitRef || "Excavation"}</strong>
                        <StatusChip meta={meta} />
                        {!r.utilitiesConfirmed ? <StatusChip tone="warn" label="Utilities unchecked" icon="!" /> : null}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                        {r.workDescription?.trim() || "No description"}
                        {r.projectName ? ` · ${r.projectName}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" style={ss.btn} onClick={() => runPrint(r)} title="Print / Save as PDF">
                        PDF
                      </button>
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
                                moduleId: "excavation",
                                moduleLabel: "Excavations",
                                itemType: "excavation",
                                itemLabel: r.permitRef || r.workDate || r.id,
                                sourceKey: "excavation_log",
                                payload: r,
                              })
                            ) {
                              setItems((p) => replaceWithTombstone(p, r.id));
                              pushAudit({ action: "excavation_delete", entity: "excavation", detail: r.id });
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                      gap: 12,
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid var(--color-border-tertiary, #e2e8f0)",
                    }}
                  >
                    <MetaCell label="Date" value={r.workDate} />
                    <MetaCell label="Depth" value={r.maxDepth ? `${r.maxDepth} m` : ""} />
                    <MetaCell label="Location" value={r.location} />
                    <MetaCell label="Support" value={r.shoringSystem} />
                    <MetaCell label="Banksman" value={r.banksmanName} />
                    <MetaCell
                      label="Utilities"
                      value={r.utilitiesConfirmed ? r.utilitySearchRef || "Confirmed" : "Not confirmed"}
                      warn={!r.utilitiesConfirmed}
                    />
                  </div>
                </div>
              );
            })}
            <RegisterListPagingFooter
              hasMore={listPg.hasMore(filtered)}
              remaining={listPg.remaining(filtered)}
              showing={Math.min(listPg.cap, filtered.length)}
              total={filtered.length}
              onShowMore={listPg.showMore}
              buttonStyle={ss.btn}
            />
          </div>
        )}
      </RegisterModuleShell>
    </div>
  );
}
