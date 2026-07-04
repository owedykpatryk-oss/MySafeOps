import { useState, useEffect, useMemo } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import {
  PROJECT_PLAYBOOKS,
  applyAndPersistProjectPlaybook,
  getPlaybook,
} from "../utils/projectPlaybooks";
import { isSuperAdminEmail } from "../utils/superAdmin";
import { billingLimitMessage, checkBillingLimit } from "../utils/billingLimits";
import ConfirmDialog from "../components/ConfirmDialog";
import { ms } from "../utils/moduleStyles";
import { geocodeAddressNominatim } from "../utils/geocode";
import PageHero from "../components/PageHero";
import BillingReadOnlyBanner from "../components/BillingReadOnlyBanner";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { getOrgId, orgScopedKey, loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import {
  CERT_LIBRARY,
  certLabel,
  addMonthsIso,
  normalizeWorkerCertifications,
  getWorkerCertAlerts,
} from "../utils/certifications";
import { pushRecycleBinItem } from "../utils/recycleBin";
import { openWorkspaceView, setWorkspaceNavTarget, consumeWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { lookupUkPostcode, resolveUkPostcodeInput } from "../utils/postcodeLookup";
import { getNearestHospital } from "../utils/nearestHospital";
import { fetchWeatherSummary, fetchWeatherForDate } from "../utils/weatherSummary";
import { boundaryFromKmlGeometry, parseKmlGeometry } from "./permits/projectDrawingImport";
import { parseProjectBoundaryRing } from "../utils/projectBoundary";
import ProjectSitePreviewMap from "../components/ProjectSitePreviewMap";
import ProjectDashboard from "../components/ProjectDashboard";
import {
  buildProjectActionContext,
  pickNextActionForProject,
  openProjectNextAction,
} from "../utils/projectNextAction";
import { isAutomationEnabled } from "../utils/orgAutomationRules";
import { cloneProjectDocuments } from "../utils/documentPropagation";

const WORKERS_KEY = "mysafeops_workers";
const PROJECTS_KEY = "mysafeops_projects";

const load = (key) => loadOrgScoped(key, []);
const save = (key, data) => saveOrgScoped(key, data);

const genId = () => `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDaysIso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Number(days || 0)));
  return d.toISOString().slice(0, 10);
};

const PROJECT_STARTERS = [
  {
    id: "general",
    label: "General construction",
    defaultPermitFlow: ["hot_work", "excavation", "electrical", "confined_space"],
    starterChecklist: [
      "Upload site drawing and mark key zones",
      "Assign HSE lead and permit approver",
      "Set project emergency contacts",
    ],
    riskHints: ["SIMOPS overlap", "unauthorised access", "temporary works"],
  },
  {
    id: "fitout",
    label: "Fit-out / interiors",
    defaultPermitFlow: ["hot_work", "electrical", "loto", "work_at_height"],
    starterChecklist: [
      "Coordinate out-of-hours noisy works",
      "Confirm fire alarm isolation procedure",
      "Set waste segregation and removal plan",
    ],
    riskHints: ["fire load", "dust exposure", "live services"],
  },
  {
    id: "infrastructure",
    label: "Infrastructure / civils",
    defaultPermitFlow: ["excavation", "lifting", "confined_space", "dsear"],
    starterChecklist: [
      "Plan utility scans and trial holes",
      "Define traffic and plant segregation",
      "Prepare adverse weather contingency",
    ],
    riskHints: ["underground services", "plant collision", "ground instability"],
  },
  {
    id: "maintenance",
    label: "Maintenance / shutdown",
    defaultPermitFlow: ["loto", "electrical", "hot_work", "confined_space"],
    starterChecklist: [
      "Create lockout/tagout authority matrix",
      "Confirm shutdown boundary and handback",
      "Define permit escalation contacts",
    ],
    riskHints: ["residual energy", "restart hazards", "restricted access"],
  },
];

function inferProjectStarter(form) {
  const hay = `${form?.name || ""} ${form?.site || ""} ${form?.address || ""}`.toLowerCase();
  if (hay.includes("fit") || hay.includes("interior") || hay.includes("refurb")) return "fitout";
  if (hay.includes("road") || hay.includes("bridge") || hay.includes("drain") || hay.includes("civils")) return "infrastructure";
  if (hay.includes("shutdown") || hay.includes("maintenance") || hay.includes("service")) return "maintenance";
  return "general";
}

function suggestProjectRisks(form) {
  const starterId = form?.industryStarter || inferProjectStarter(form);
  const preset = PROJECT_STARTERS.find((p) => p.id === starterId) || PROJECT_STARTERS[0];
  const address = String(form?.address || "").toLowerCase();
  const extra = [];
  if (address.includes("school") || address.includes("hospital")) extra.push("public interface");
  if (address.includes("city") || address.includes("high street")) extra.push("traffic management");
  return Array.from(new Set([...(preset.riskHints || []), ...extra])).slice(0, 8);
}

function projectMissingItems(form) {
  const missing = [];
  if (!String(form?.name || "").trim()) missing.push("Project name");
  if (!String(form?.site || "").trim()) missing.push("Site / client");
  if (!String(form?.address || "").trim()) missing.push("Address");
  if (!String(form?.owner || "").trim()) missing.push("Project owner");
  if (!String(form?.hseLead || "").trim()) missing.push("HSE lead");
  if (!String(form?.timelineStart || "").trim()) missing.push("Start date");
  if (!String(form?.timelineEnd || "").trim()) missing.push("Target end date");
  if ((form?.lat == null || form?.lat === "") || (form?.lng == null || form?.lng === "")) missing.push("Coordinates");
  return missing;
}

function projectHealthScore(form) {
  const checks = [
    Boolean(String(form?.name || "").trim()),
    Boolean(String(form?.site || "").trim()),
    Boolean(String(form?.address || "").trim()),
    Boolean(String(form?.owner || "").trim()),
    Boolean(String(form?.hseLead || "").trim()),
    Boolean(String(form?.timelineStart || "").trim()),
    Boolean(String(form?.timelineEnd || "").trim()),
    form?.lat != null && form?.lat !== "" && form?.lng != null && form?.lng !== "",
    Array.isArray(form?.riskRegister) && form.riskRegister.length > 0,
    Boolean(String(form?.industryStarter || "").trim()),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function buildStartupChecklist(form) {
  const starterId = form?.industryStarter || inferProjectStarter(form);
  const preset = PROJECT_STARTERS.find((p) => p.id === starterId) || PROJECT_STARTERS[0];
  const base = [
    "Invite site team and assign responsibilities",
    "Review permit default flow for this project",
    "Run pre-start safety briefing",
    ...(preset.starterChecklist || []),
  ];
  const missing = projectMissingItems(form).map((m) => `Fill missing: ${m}`);
  return Array.from(new Set([...base, ...missing])).slice(0, 16).map((text, idx) => ({
    id: `pc_${Date.now().toString(36)}_${idx}`,
    text,
    status: "todo",
  }));
}

const ss = { ...ms, btnO: { padding: "10px 14px", borderRadius: 6, border: "0.5px solid #c2410c", background: "#f97316", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", minHeight: 44, lineHeight: 1.3 } };

function toCsv(rows) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function certSummaryText(worker) {
  const certs = normalizeWorkerCertifications(worker);
  if (certs.length === 0) return "";
  return certs.map((c) => `${c.certType}${c.expiryDate ? ` (${c.expiryDate})` : ""}`).join("; ");
}

export function WorkersModule({ mode = "all" }) {
  const showPeople = mode === "all" || mode === "people";
  const showProjects = mode === "all" || mode === "projects";
  const { trialStatus, billing } = useApp();
  const { user } = useSupabaseAuth();
  const { pushToast } = useToast();
  const isPlatformOwner = isSuperAdminEmail(user?.email);
  const [workers, setWorkers] = useState(() => load(WORKERS_KEY, []));
  const [projects, setProjects] = useState(() => load(PROJECTS_KEY, []));
  const [modal, setModal] = useState(null);
  const [hubProject, setHubProject] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const useInlineHub = mode === "projects";

  const { d1Hydrating, d1OutboxPending } = useD1WorkersProjectsSync({
    workers,
    setWorkers,
    projects,
    setProjects,
    load,
    save,
  });
  const workersPg = useRegisterListPaging(50);
  const projectsPg = useRegisterListPaging(50);

  const projectActionCtx = useMemo(
    () =>
      buildProjectActionContext({
        rams: load("rams_builder_docs", []),
        surveys: load("survey_reports", []),
        permits: load("permits_v2", []),
        methodStatements: load("method_statements", []),
      }),
    [projects]
  );

  const openProjectHub = (project) => {
    if (useInlineHub) setHubProject(project);
    else setModal({ type: "project-dashboard", data: project });
  };

  useEffect(() => {
    const t = consumeWorkspaceNavTarget();
    const viewOk =
      (mode === "projects" && (t?.viewId === "projects" || t?.viewId === "workers")) ||
      (mode === "people" && t?.viewId === "people") ||
      (mode === "all" && t?.viewId === "workers");
    if (!viewOk) return;
    if (t?.action === "createProject" && showProjects) {
      setModal({ type: "project", data: null });
      return;
    }
    if (t?.action === "editProject" && t?.projectId && showProjects) {
      const list = load(PROJECTS_KEY, []);
      const p = list.find((x) => x.id === t.projectId);
      if (p) setModal({ type: "project", data: p });
      return;
    }
    if (t?.action === "viewProjectDashboard" && t?.projectId && showProjects) {
      const list = load(PROJECTS_KEY, []);
      const p = list.find((x) => x.id === t.projectId);
      if (p) openProjectHub(p);
    }
  }, [mode, showProjects, useInlineHub]);

  const billingOpts = { trialStatus, billing, isPlatformOwner };

  const tryAddWorker = () => {
    const gate = checkBillingLimit("workers", billingOpts);
    if (!gate.ok) {
      pushToast(billingLimitMessage(gate), "warn");
      return;
    }
    setModal({ type: "worker", data: null });
  };

  const tryAddProject = () => {
    const gate = checkBillingLimit("projects", billingOpts);
    if (!gate.ok) {
      pushToast(billingLimitMessage(gate), "warn");
      return;
    }
    setModal({ type: "project", data: null });
  };

  const updateProjectRecord = (updated) => {
    setProjects((prev) => {
      const i = prev.findIndex((p) => p.id === updated.id);
      if (i < 0) return prev;
      const next = [...prev];
      next[i] = updated;
      return next;
    });
    setModal((m) => (m?.type === "project-dashboard" && m.data?.id === updated.id ? { ...m, data: updated } : m));
    setHubProject((p) => (p?.id === updated.id ? updated : p));
  };

  const exportWorkersCsv = () => {
    const header = ["Name", "Role", "Phone", "Email", "Certs / notes", "Structured certifications"];
    const rows = workers.map((w) => [w.name || "", w.role || "", w.phone || "", w.email || "", w.certs || "", certSummaryText(w)]);
    const blob = new Blob([toCsv([header, ...rows])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workers_${getOrgId()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveWorker = (form) => {
    const isNew = !workers.some((w) => w.id === form.id);
    if (isNew) {
      const gate = checkBillingLimit("workers", billingOpts);
      if (!gate.ok) {
        pushToast(billingLimitMessage(gate), "warn");
        return;
      }
    }
    setWorkers((prev) => {
      const i = prev.findIndex((x) => x.id === form.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = form;
        return next;
      }
      return [form, ...prev];
    });
    setModal(null);
  };

  const removeWorker = (id) => {
    setConfirm({
      title: "Remove worker?",
      message: "This worker will be moved to the recycle bin.",
      tone: "danger",
      onConfirm: () => {
        setWorkers((prev) => {
          const victim = prev.find((w) => w.id === id);
          if (victim) {
            pushRecycleBinItem({
              moduleId: "workers",
              moduleLabel: "Workers",
              itemType: "worker",
              itemLabel: victim.name || victim.id,
              sourceKey: WORKERS_KEY,
              payload: victim,
            });
          }
          return prev.filter((w) => w.id !== id);
        });
        setConfirm(null);
      },
    });
  };

  const saveProject = (form, options = {}) => {
    const isNew = !projects.some((p) => p.id === form.id);
    if (isNew) {
      const gate = checkBillingLimit("projects", billingOpts);
      if (!gate.ok) {
        pushToast(billingLimitMessage(gate), "warn");
        return;
      }
    }

    let saved = form;
    const playbookId = options.applyPlaybook || form.playbookId;
    const shouldApplyPlaybook =
      playbookId &&
      (options.reapplyPlaybook || (isNew && isAutomationEnabled("autoApplyPlaybookOnCreate")));
    if (shouldApplyPlaybook) {
      try {
        const result = applyAndPersistProjectPlaybook(form, playbookId);
        saved = result.project;
        if (result.applied && result.summary.length) {
          pushToast(`Playbook applied: ${result.summary.join(" · ")}`, "success");
        } else if (options.reapplyPlaybook && !result.applied) {
          pushToast("All playbook documents already exist for this project.", "info");
        }
      } catch (e) {
        pushToast(e?.message || "Playbook could not be applied.", "warn");
      }
    }

    setProjects((prev) => {
      const i = prev.findIndex((x) => x.id === saved.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setModal(null);
    if (useInlineHub && isNew) {
      openProjectHub(saved);
    }
    if (options.openDrawingEditor) {
      setWorkspaceNavTarget({ viewId: "project-drawings", projectId: saved.id });
      openWorkspaceView({ viewId: "project-drawings" });
    }
  };

  const removeProject = (id) => {
    setConfirm({
      title: "Remove project?",
      message: "Linked documents stay in their modules; the project record goes to the recycle bin.",
      tone: "danger",
      onConfirm: () => {
        setProjects((prev) => {
          const victim = prev.find((p) => p.id === id);
          if (victim) {
            pushRecycleBinItem({
              moduleId: "workers",
              moduleLabel: "Workers",
              itemType: "project",
              itemLabel: victim.name || victim.id,
              sourceKey: PROJECTS_KEY,
              payload: victim,
            });
          }
          return prev.filter((p) => p.id !== id);
        });
        setHubProject((p) => (p?.id === id ? null : p));
        setConfirm(null);
      },
    });
  };

  const certAlerts = workers
    .flatMap((w) => getWorkerCertAlerts(w).map((a) => ({ ...a, worker: w })))
    .sort((a, b) => a.days - b.days);
  const criticalAlerts = certAlerts.filter((a) => a.severity === "expired" || a.severity === "critical");

  const handleApplyPlaybook = (p, playbookId) => {
    try {
      const result = applyAndPersistProjectPlaybook(p, playbookId);
      updateProjectRecord(result.project);
      if (result.applied) {
        pushToast(`Playbook applied: ${result.summary.join(" · ")}`, "success");
      } else {
        pushToast("All playbook documents already exist.", "info");
      }
    } catch (e) {
      pushToast(e?.message || "Playbook failed.", "warn");
    }
  };

  const renderProjectHub = (project, { embedded, onClose }) => (
    <ProjectDashboard
      embedded={embedded}
      project={project}
      workers={workers}
      allProjects={projects}
      onClose={onClose}
      onEdit={(p) => {
        if (embedded) setHubProject(null);
        setModal({ type: "project", data: p });
      }}
      onRemove={(id) => {
        onClose();
        removeProject(id);
      }}
      onUpdateProject={updateProjectRecord}
      onApplyPlaybook={handleApplyPlaybook}
      onCloneDocuments={(source, targetId, opts = {}) => {
        try {
          const summary = cloneProjectDocuments(source.id, targetId, {
            includePermits: false,
            includeGeoPhotos: Boolean(opts.includeGeoPhotos),
          });
          const labelMap = {
            rams: "RAMS",
            surveys: "surveys",
            permits: "permits",
            methodStatements: "method statements",
            geoPhotos: "geo-photos",
          };
          const parts = Object.entries(summary)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${labelMap[k] || k}`);
          if (!parts.length) {
            pushToast("No documents to copy on the source project.", "info");
            return;
          }
          pushToast(`Copied ${parts.join(", ")} to target project.`, "success");
        } catch (e) {
          pushToast(e?.message || "Clone failed.", "warn");
        }
      }}
    />
  );

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, color: "var(--color-text-primary)" }}>
      <D1ModuleSyncBanner
        d1Hydrating={d1Hydrating}
        d1OutboxPending={d1OutboxPending}
        scopeLabel="workers and projects"
      />
      {modal?.type === "worker" && (
        <WorkerForm
          item={modal.data}
          onSave={saveWorker}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "project" && (
        <ProjectForm
          item={modal.data}
          onSave={saveProject}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "project-dashboard" && !useInlineHub && renderProjectHub(modal.data, { embedded: false, onClose: () => setModal(null) })}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        tone={confirm?.tone}
        confirmLabel={confirm?.tone === "danger" ? "Remove" : "Confirm"}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <BillingReadOnlyBanner />

      <PageHero
        badgeText={showProjects && !showPeople ? "PR" : showPeople && !showProjects ? "TM" : "WP"}
        title={showProjects && !showPeople ? "Projects" : showPeople && !showProjects ? "People" : "Workers & projects"}
        lead={
          showProjects && !showPeople
            ? "Sites and project hubs — open a project for RAMS, permits, surveys, drawings and playbooks."
            : showPeople && !showProjects
              ? "Operatives on site — certifications, roles and project assignments."
              : "People and sites used across RAMS, permits, daily briefings, site map, and registers."
        }
        right={
          <>
            {useInlineHub && hubProject ? (
              <button type="button" style={ss.btn} onClick={() => setHubProject(null)}>
                ← All projects
              </button>
            ) : null}
            {showPeople && !(useInlineHub && hubProject) ? (
              <button type="button" style={ss.btnP} onClick={tryAddWorker}>
                Add person
              </button>
            ) : null}
            {showProjects && !(useInlineHub && hubProject) ? (
              <button type="button" style={ss.btnO} onClick={tryAddProject}>
                Add project
              </button>
            ) : null}
            {showPeople && !(useInlineHub && hubProject) ? (
              <button type="button" style={ss.btn} onClick={exportWorkersCsv}>
                Export CSV
              </button>
            ) : null}
          </>
        }
      />

      {useInlineHub && hubProject
        ? renderProjectHub(hubProject, { embedded: true, onClose: () => setHubProject(null) })
        : null}

      {!(useInlineHub && hubProject) && showPeople ? (
      <>
      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600 }}>Certification alerts</div>
          <span style={ss.chip}>{certAlerts.length} alert(s)</span>
        </div>
        {certAlerts.length === 0 ? (
          <div style={{ marginTop: 8, color: "var(--color-text-secondary)", fontSize: 13 }}>No expiring certifications right now.</div>
        ) : (
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {certAlerts.slice(0, 8).map((a) => (
              <div key={`${a.worker.id}_${a.cert.certCode}_${a.cert.expiryDate}`} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: a.severity === "expired" ? "#FCEBEB" : a.severity === "critical" ? "#FCEBEB" : "#FAEEDA", color: a.severity === "warning" ? "#633806" : "#791F1F" }}>
                <strong>{a.worker.name || "Unnamed worker"}</strong> · {a.cert.certType} ·{" "}
                {a.days < 0 ? `expired ${Math.abs(a.days)} day(s) ago` : `expires in ${a.days} day(s)`}
              </div>
            ))}
            {criticalAlerts.length > 0 ? (
              <div style={{ fontSize: 11, color: "#791F1F" }}>
                Critical: {criticalAlerts.length} certificate(s) require immediate action.
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          People ({workers.length})
        </div>
        {workers.length === 0 && <div style={{ color: "var(--color-text-secondary)" }}>No people on the register yet.</div>}
        {workersPg.hasMore(workers) ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
            Showing {Math.min(workersPg.cap, workers.length)} of {workers.length}
          </div>
        ) : null}
        {workersPg.visible(workers).map((w) => (
          <div
            key={w.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
            }}
          >
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <strong>{w.name || "Unnamed"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{w.role || "—"} · {w.phone || w.email || ""}</div>
              {normalizeWorkerCertifications(w).length > 0 ? (
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                  {normalizeWorkerCertifications(w)
                    .slice(0, 3)
                    .map((c) => `${c.certType}${c.expiryDate ? ` (${c.expiryDate})` : ""}`)
                    .join(" · ")}
                </div>
              ) : null}
            </div>
            <button type="button" style={ss.btn} onClick={() => setModal({ type: "worker", data: w })}>
              Edit
            </button>
            <button type="button" style={ss.btn} onClick={() => removeWorker(w.id)}>
              Remove
            </button>
          </div>
        ))}
        {workersPg.hasMore(workers) ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <button type="button" style={ss.btn} onClick={workersPg.showMore}>
              Show more ({workersPg.remaining(workers)} remaining)
            </button>
          </div>
        ) : null}
      </div>
      </>
      ) : null}

      {showProjects && !(useInlineHub && hubProject) ? (
      <div className="app-surface-card" style={ss.card}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          Projects ({projects.length})
        </div>
        {projects.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
            No projects yet. Add a site, pick a playbook on save, then open the project hub for RAMS, survey and PTW drafts.
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
            Click a project name to open its hub — documents, checklist and quick actions live there.
          </p>
        )}
        {projectsPg.hasMore(projects) ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
            Showing {Math.min(projectsPg.cap, projects.length)} of {projects.length}
          </div>
        ) : null}
        {projectsPg.visible(projects).map((p) => {
          const nextAction = pickNextActionForProject(p, projectActionCtx);
          return (
          <div
            key={p.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
            }}
          >
            <button
              type="button"
              className="app-project-row-open"
              style={{ flex: "1 1 200px", minWidth: 0, textAlign: "left" }}
              onClick={() => openProjectHub(p)}
            >
              <strong>{p.name || "Unnamed"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{p.site || p.address || ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                <span
                  style={{
                    ...ss.chip,
                    fontSize: 11,
                    background: (p.healthScore || 0) >= 80 ? "#EAF3DE" : (p.healthScore || 0) >= 50 ? "#FAEEDA" : "#FCEBEB",
                    color: (p.healthScore || 0) >= 80 ? "#27500A" : (p.healthScore || 0) >= 50 ? "#633806" : "#791F1F",
                  }}
                >
                  Health {Number(p.healthScore || 0)}%
                </span>
                {Array.isArray(p.startupChecklist) ? (
                  <span style={{ ...ss.chip, fontSize: 11 }}>
                    Checklist {p.startupChecklist.filter((x) => x?.status !== "done").length} open
                  </span>
                ) : null}
                {nextAction ? (
                  <span
                    style={{
                      ...ss.chip,
                      fontSize: 11,
                      background: nextAction.tone === "warn" ? "#FAEEDA" : "#E8F4FC",
                      color: nextAction.tone === "warn" ? "#633806" : "#1e4976",
                    }}
                  >
                    Next: {nextAction.label}
                  </span>
                ) : null}
              </div>
            </button>
            {nextAction ? (
              <button type="button" style={{ ...ss.btn, borderColor: "#0d9488", color: "#0f766e" }} onClick={() => openProjectNextAction(nextAction)}>
                {nextAction.label}
              </button>
            ) : null}
            <button type="button" style={ss.btn} onClick={() => openProjectHub(p)}>
              Open hub
            </button>
            <button type="button" style={ss.btn} onClick={() => setModal({ type: "project", data: p })}>
              Edit
            </button>
            {mode === "all" ? (
            <>
            <button
              type="button"
              style={ss.btn}
              onClick={() => {
                setWorkspaceNavTarget({ viewId: "rams", projectId: p.id });
                openWorkspaceView({ viewId: "rams" });
              }}
            >
              RAMS
            </button>
            <button
              type="button"
              style={ss.btn}
              onClick={() => {
                setWorkspaceNavTarget({ viewId: "permits", projectId: p.id });
                openWorkspaceView({ viewId: "permits" });
              }}
            >
              Permit
            </button>
            <button
              type="button"
              style={ss.btn}
              onClick={() => {
                setWorkspaceNavTarget({ viewId: "survey-report", projectId: p.id });
                openWorkspaceView({ viewId: "survey-report" });
              }}
            >
              Survey
            </button>
            <button
              type="button"
              style={ss.btn}
              onClick={() => {
                setWorkspaceNavTarget({ viewId: "geo-photos", projectId: p.id, action: "capture" });
                openWorkspaceView({ viewId: "geo-photos" });
              }}
            >
              Geo
            </button>
            </>
            ) : null}
            <button type="button" style={ss.btn} onClick={() => removeProject(p.id)}>
              Remove
            </button>
          </div>
          );
        })}
        {projectsPg.hasMore(projects) ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <button type="button" style={ss.btn} onClick={projectsPg.showMore}>
              Show more ({projectsPg.remaining(projects)} remaining)
            </button>
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

export default function Workers() {
  return <WorkersModule mode="all" />;
}

function workerFormShape(w) {
  const baseMatrix = Object.fromEntries(
    CERT_LIBRARY.map((c) => [
      c.code,
      { enabled: false, expiryDate: "", certNumber: "", provider: "" },
    ])
  );
  if (w) {
    normalizeWorkerCertifications(w).forEach((c) => {
      const key = String(c.certCode || "").toLowerCase();
      if (baseMatrix[key]) {
        baseMatrix[key] = {
          enabled: true,
          expiryDate: c.expiryDate || "",
          certNumber: c.certNumber || "",
          provider: c.provider || "",
        };
      }
    });
  }
  if (!w) {
    return {
      id: genId(),
      name: "",
      role: "",
      phone: "",
      email: "",
      certs: "",
      certType: "",
      certExpiry: "",
      certifications: [],
      certMatrix: baseMatrix,
      projectIds: [],
    };
  }
  const c0 = w.certifications?.[0];
  return {
    ...w,
    certType: c0?.certType || "",
    certExpiry: c0?.expiryDate || "",
    certMatrix: baseMatrix,
  };
}

function WorkerForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => workerFormShape(item));
  const [certFilter, setCertFilter] = useState("");
  useEffect(() => {
    setForm(workerFormShape(item));
  }, [item?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCert = (code, key, value) =>
    setForm((f) => ({
      ...f,
      certMatrix: {
        ...(f.certMatrix || {}),
        [code]: { ...(f.certMatrix?.[code] || {}), [key]: value },
      },
    }));

  const toggleCert = (code, enabled) => {
    setForm((f) => {
      const prev = f.certMatrix?.[code] || {};
      const lib = CERT_LIBRARY.find((x) => x.code === code);
      return {
        ...f,
        certMatrix: {
          ...(f.certMatrix || {}),
          [code]: {
            ...prev,
            enabled,
            expiryDate: enabled ? prev.expiryDate || addMonthsIso(new Date().toISOString(), lib?.defaultValidityMonths || 24) : prev.expiryDate || "",
          },
        },
      };
    });
  };

  const persist = () => {
    const certs = [];
    if (form.certType?.trim() && form.certExpiry) {
      certs.push({ certType: form.certType.trim(), expiryDate: form.certExpiry });
    }
    const rest = (form.certifications || []).filter((c) => c?.certType && c?.expiryDate);
    const merged = [...rest, ...certs];
    const matrixRows = Object.entries(form.certMatrix || {})
      .filter(([, v]) => v?.enabled)
      .map(([code, v]) => ({
        certCode: code,
        certType: certLabel(code),
        expiryDate: String(v.expiryDate || "").slice(0, 10),
        certNumber: String(v.certNumber || ""),
        provider: String(v.provider || ""),
      }));
    const mergedAll = [...merged, ...matrixRows];
    const uniqueAll = mergedAll.filter(
      (c, i, a) =>
        a.findIndex(
          (x) =>
            String(x.certCode || x.certType).toLowerCase() === String(c.certCode || c.certType).toLowerCase() &&
            String(x.expiryDate || "") === String(c.expiryDate || "")
        ) === i
    );
    onSave({ ...form, certifications: uniqueAll });
  };

  const visibleCatalog = CERT_LIBRARY.filter((c) => c.label.toLowerCase().includes(certFilter.trim().toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>{item ? "Edit worker" : "New worker"}</h2>
        <label style={ss.lbl}>Name</label>
        <input style={ss.inp} value={form.name} onChange={(e) => set("name", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Role</label>
        <input style={ss.inp} value={form.role} onChange={(e) => set("role", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Phone</label>
        <input style={ss.inp} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Email</label>
        <input style={ss.inp} value={form.email} onChange={(e) => set("email", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Primary certificate (for dashboard expiry)</label>
        <input style={ss.inp} value={form.certType || ""} onChange={(e) => set("certType", e.target.value)} placeholder="e.g. CSCS, IPAF" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Certificate expiry</label>
        <input type="date" style={ss.inp} value={form.certExpiry || ""} onChange={(e) => set("certExpiry", e.target.value)} />
        <div style={{ marginTop: 12, border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: "10px 10px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Ready-made certifications</strong>
            <input
              value={certFilter}
              onChange={(e) => setCertFilter(e.target.value)}
              placeholder="Filter certs..."
              style={{ ...ss.inp, width: "auto", minWidth: 160, fontSize: 12, padding: "6px 8px" }}
            />
          </div>
          <div style={{ maxHeight: 260, overflow: "auto", display: "grid", gap: 8 }}>
            {visibleCatalog.map((c) => {
              const row = form.certMatrix?.[c.code] || {};
              return (
                <div key={c.code} style={{ border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: "8px 8px 6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={row.enabled === true} onChange={(e) => toggleCert(c.code, e.target.checked)} />
                    {c.label}
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: "auto" }}>
                      default {c.defaultValidityMonths}m
                    </span>
                  </label>
                  {row.enabled ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 6, marginTop: 6 }}>
                      <input
                        type="date"
                        style={{ ...ss.inp, margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={row.expiryDate || ""}
                        onChange={(e) => setCert(c.code, "expiryDate", e.target.value)}
                      />
                      <input
                        style={{ ...ss.inp, margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={row.certNumber || ""}
                        onChange={(e) => setCert(c.code, "certNumber", e.target.value)}
                        placeholder="Certificate no."
                      />
                      <input
                        style={{ ...ss.inp, margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={row.provider || ""}
                        onChange={(e) => setCert(c.code, "provider", e.target.value)}
                        placeholder="Provider"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Certificates / notes (free text)</label>
        <textarea style={{ ...ss.inp, minHeight: 72, resize: "vertical" }} value={form.certs} onChange={(e) => set("certs", e.target.value)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={persist}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function projectFormShape(p) {
  if (!p) {
    return {
      id: genId(),
      name: "",
      site: "",
      address: "",
      postcode: "",
      lat: "",
      lng: "",
      industryStarter: "general",
      owner: "",
      hseLead: "",
      siteManager: "",
      contractorLead: "",
      timelineStart: todayIso(),
      timelineEnd: addDaysIso(90),
      riskRegister: [],
      startupChecklist: [],
      permitDefaults: { requiredPermitTypes: PROJECT_STARTERS[0].defaultPermitFlow },
      healthScore: 0,
      healthMissing: [],
      nearestHospital: "",
      hospitalDirectionsUrl: "",
      weatherSnapshot: "",
      weatherFetchedAt: "",
      weatherAtStartSnapshot: "",
      weatherAtStartDate: "",
      mapEscapeRoutes: [],
      boundaryGeoJson: null,
      boundaryPoints: [],
      boundarySource: "",
      boundaryName: "",
    };
  }
  return {
    ...p,
    lat: p.lat != null && p.lat !== "" ? String(p.lat) : "",
    lng: p.lng != null && p.lng !== "" ? String(p.lng) : "",
    postcode: p.postcode || "",
    industryStarter: p.industryStarter || inferProjectStarter(p),
    owner: p.owner || "",
    hseLead: p.hseLead || "",
    siteManager: p.siteManager || "",
    contractorLead: p.contractorLead || "",
    timelineStart: p.timelineStart || todayIso(),
    timelineEnd: p.timelineEnd || addDaysIso(90),
    riskRegister: Array.isArray(p.riskRegister) ? p.riskRegister.slice(0, 12) : suggestProjectRisks(p),
    startupChecklist: Array.isArray(p.startupChecklist) ? p.startupChecklist.slice(0, 30) : [],
    permitDefaults: p.permitDefaults || { requiredPermitTypes: PROJECT_STARTERS[0].defaultPermitFlow },
    playbookId: p.playbookId || "general",
  };
}

function ProjectForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => projectFormShape(item));
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [kmlBusy, setKmlBusy] = useState(false);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const missing = projectMissingItems(form);
  const health = projectHealthScore(form);
  const starterMeta = PROJECT_STARTERS.find((p) => p.id === form.industryStarter) || PROJECT_STARTERS[0];
  const boundaryRing = parseProjectBoundaryRing(form);

  const importKmlBoundary = async (file) => {
    if (!file) return;
    setKmlBusy(true);
    setGeoMsg("");
    try {
      const text = await file.text();
      const geom = parseKmlGeometry(text);
      const boundary = boundaryFromKmlGeometry(geom, { sourceName: file.name });
      if (!boundary) {
        setGeoMsg("No polygon found in KML — use a closed site boundary.");
        return;
      }
      setForm((f) => ({
        ...f,
        ...boundary,
        boundaryImportedAt: new Date().toISOString(),
        mapEscapeRoutes: (geom.lineStrings || []).map((line, idx) => ({
          id: `mer_${Date.now()}_${idx}`,
          name: line.name || `Route ${idx + 1}`,
          points: line.points.map((p) => ({ lat: p.lat, lng: p.lng })),
        })),
      }));
      const routeNote = geom.lineStrings?.length ? ` · ${geom.lineStrings.length} map route(s)` : "";
      setGeoMsg(`KML boundary imported (${boundary.boundaryPoints.length} points)${routeNote}.`);
    } catch (e) {
      setGeoMsg(e?.message || "KML import failed.");
    } finally {
      setKmlBusy(false);
    }
  };

  const clearBoundary = () => {
    setForm((f) => ({
      ...f,
      boundaryGeoJson: null,
      boundaryPoints: [],
      boundarySource: "",
      boundaryName: "",
    }));
    setGeoMsg("Boundary cleared.");
  };

  const fetchStartForecast = async () => {
    let lat = parseFloat(String(form.lat ?? "").trim(), 10);
    let lng = parseFloat(String(form.lng ?? "").trim(), 10);
    const postcodeQuery = resolveUkPostcodeInput(form.postcode, form.address, form.site);
    const start = String(form.timelineStart || "").trim().slice(0, 10);
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && postcodeQuery) {
      const pc = await lookupUkPostcode(postcodeQuery);
      if (pc) {
        lat = pc.lat;
        lng = pc.lng;
        setForm((f) => ({
          ...f,
          lat: String(pc.lat),
          lng: String(pc.lng),
          postcode: pc.postcode,
        }));
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setGeoMsg("Set coordinates first (step 3 — postcode lookup).");
      return;
    }
    if (!start) {
      setGeoMsg("Set target start date first.");
      return;
    }
    setForecastBusy(true);
    setGeoMsg("");
    try {
      const forecast = await fetchWeatherForDate(lat, lng, start, {
        postcode: postcodeQuery || undefined,
      });
      setForm((f) => ({
        ...f,
        weatherAtStartSnapshot: forecast?.text || "",
        weatherAtStartDate: start,
      }));
      setGeoMsg("Start-date forecast saved on project.");
    } catch (e) {
      setGeoMsg(e?.message || "Forecast failed.");
    } finally {
      setForecastBusy(false);
    }
  };

  useEffect(() => {
    setForm(projectFormShape(item));
    setStep(1);
  }, [item?.id]);

  const applyAutoSuggest = () => {
    const nextStarter = inferProjectStarter(form);
    const starter = PROJECT_STARTERS.find((p) => p.id === nextStarter) || PROJECT_STARTERS[0];
    setForm((f) => ({
      ...f,
      industryStarter: nextStarter,
      riskRegister: suggestProjectRisks({ ...f, industryStarter: nextStarter }),
      permitDefaults: {
        ...(f.permitDefaults || {}),
        requiredPermitTypes: starter.defaultPermitFlow,
      },
      owner: f.owner || "Project lead",
      hseLead: f.hseLead || "HSE lead",
    }));
  };

  const persist = (options = {}) => {
    const latRaw = String(form.lat ?? "").trim();
    const lngRaw = String(form.lng ?? "").trim();
    const lat = latRaw === "" ? undefined : Number(latRaw);
    const lng = lngRaw === "" ? undefined : Number(lngRaw);
    const safeStarter = form.industryStarter || inferProjectStarter(form);
    const starter = PROJECT_STARTERS.find((p) => p.id === safeStarter) || PROJECT_STARTERS[0];
    const normalizedRiskRegister =
      Array.isArray(form.riskRegister) && form.riskRegister.length > 0
        ? form.riskRegister.slice(0, 12)
        : suggestProjectRisks({ ...form, industryStarter: safeStarter });
    const draft = {
      ...form,
      industryStarter: safeStarter,
      riskRegister: normalizedRiskRegister,
      permitDefaults: {
        ...(form.permitDefaults || {}),
        requiredPermitTypes:
          Array.isArray(form.permitDefaults?.requiredPermitTypes) && form.permitDefaults.requiredPermitTypes.length
            ? form.permitDefaults.requiredPermitTypes.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
            : starter.defaultPermitFlow,
      },
    };
    const nextMissing = projectMissingItems(draft);
    const nextHealth = projectHealthScore(draft);
    onSave({
      ...draft,
      lat: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
      lng: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
      healthScore: nextHealth,
      healthMissing: nextMissing,
      startupChecklist:
        Array.isArray(draft.startupChecklist) && draft.startupChecklist.length > 0
          ? draft.startupChecklist.slice(0, 30)
          : buildStartupChecklist(draft),
    }, {
      ...options,
      applyPlaybook: !item?.id ? draft.playbookId : options.applyPlaybook,
    });
  };

  const geocode = async () => {
    const postcodeQuery = resolveUkPostcodeInput(form.postcode, form.address, form.site);
    const q = [postcodeQuery || form.postcode, form.address, form.site].filter(Boolean).join(", ").trim();
    if (!q) {
      setGeoMsg("Enter postcode or address first.");
      return;
    }
    setGeoBusy(true);
    setGeoMsg("");
    try {
      if (postcodeQuery) {
        const pc = await lookupUkPostcode(postcodeQuery);
        if (pc) {
          setForm((f) => ({
            ...f,
            lat: String(pc.lat),
            lng: String(pc.lng),
            postcode: pc.postcode,
            address: f.address?.trim() ? f.address : [pc.adminDistrict, pc.region].filter(Boolean).join(", "),
          }));
          setGeoMsg("Coordinates from UK postcode lookup.");
          return;
        }
        setGeoMsg(`Postcode "${postcodeQuery}" not found — check spelling or try a fuller address.`);
        return;
      }
      const c = await geocodeAddressNominatim(`${q}, United Kingdom`);
      if (!c) {
        setGeoMsg("No coordinates found — try a UK postcode (e.g. KT22 7SH) or fuller address.");
        return;
      }
      setForm((f) => ({ ...f, lat: String(c.lat), lng: String(c.lng) }));
      setGeoMsg("Coordinates from address search.");
    } catch (e) {
      setGeoMsg(e?.message || "Geocoding failed.");
    } finally {
      setGeoBusy(false);
    }
  };

  const enrichSite = async () => {
    let lat = parseFloat(String(form.lat ?? "").trim(), 10);
    let lng = parseFloat(String(form.lng ?? "").trim(), 10);
    const postcodeQuery = resolveUkPostcodeInput(form.postcode, form.address, form.site);
    setEnrichBusy(true);
    setGeoMsg("");
    try {
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && postcodeQuery) {
        const pc = await lookupUkPostcode(postcodeQuery);
        if (pc) {
          lat = pc.lat;
          lng = pc.lng;
          setForm((f) => ({
            ...f,
            lat: String(pc.lat),
            lng: String(pc.lng),
            postcode: pc.postcode,
          }));
        }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setGeoMsg(
          postcodeQuery
            ? `Postcode "${postcodeQuery}" not found — use Lookup coordinates first.`
            : "Set coordinates first (postcode lookup or geocode button)."
        );
        return;
      }
      const [weather, hospital] = await Promise.all([
        fetchWeatherSummary(lat, lng).catch(() => null),
        getNearestHospital(lat, lng).catch(() => null),
      ]);
      setForm((f) => ({
        ...f,
        lat: String(lat),
        lng: String(lng),
        weatherSnapshot: weather?.text || f.weatherSnapshot || "",
        weatherFetchedAt: weather?.fetchedAt || f.weatherFetchedAt || "",
        nearestHospital: hospital?.summary || f.nearestHospital || "",
        hospitalDirectionsUrl: hospital?.directions_url || f.hospitalDirectionsUrl || "",
      }));
      const bits = [];
      if (weather) bits.push("weather");
      if (hospital) bits.push("nearest A&E");
      setGeoMsg(bits.length ? `Updated: ${bits.join(" + ")}.` : "Could not fetch weather or hospital — try again.");
    } catch (e) {
      setGeoMsg(e?.message || "Site enrichment failed.");
    } finally {
      setEnrichBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>{item ? "Edit project wizard" : "New project wizard"}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={ss.chip}>Step {step}/{totalSteps}</span>
          <span style={{ ...ss.chip, background: health >= 80 ? "#EAF3DE" : health >= 50 ? "#FAEEDA" : "#FCEBEB", color: health >= 80 ? "#27500A" : health >= 50 ? "#633806" : "#791F1F" }}>
            Health score {health}%
          </span>
          <button type="button" style={{ ...ss.btn, marginLeft: "auto" }} onClick={applyAutoSuggest}>
            Auto-suggest
          </button>
        </div>

        {step === 1 ? (
          <>
            <label style={ss.lbl}>Project name</label>
            <input style={ss.inp} value={form.name} onChange={(e) => set("name", e.target.value)} />
            <label style={{ ...ss.lbl, marginTop: 10 }}>Site / client</label>
            <input style={ss.inp} value={form.site} onChange={(e) => set("site", e.target.value)} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <label style={ss.lbl}>Industry starter</label>
            <select
              style={ss.inp}
              value={form.industryStarter || "general"}
              onChange={(e) => {
                const id = e.target.value;
                const preset = PROJECT_STARTERS.find((p) => p.id === id) || PROJECT_STARTERS[0];
                setForm((f) => ({
                  ...f,
                  industryStarter: id,
                  permitDefaults: { ...(f.permitDefaults || {}), requiredPermitTypes: preset.defaultPermitFlow },
                }));
              }}
            >
              {PROJECT_STARTERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <label style={{ ...ss.lbl, marginTop: 10 }}>Project owner</label>
            <input style={ss.inp} value={form.owner || ""} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. PM / contract manager" />
            <label style={{ ...ss.lbl, marginTop: 10 }}>HSE lead</label>
            <input style={ss.inp} value={form.hseLead || ""} onChange={(e) => set("hseLead", e.target.value)} />
            <label style={{ ...ss.lbl, marginTop: 10 }}>Site manager</label>
            <input style={ss.inp} value={form.siteManager || ""} onChange={(e) => set("siteManager", e.target.value)} />
            <label style={{ ...ss.lbl, marginTop: 10 }}>Main contractor lead</label>
            <input style={ss.inp} value={form.contractorLead || ""} onChange={(e) => set("contractorLead", e.target.value)} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <label style={ss.lbl}>Address</label>
            <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.address} onChange={(e) => set("address", e.target.value)} />
            <label style={{ ...ss.lbl, marginTop: 10 }}>Postcode</label>
            <input
              style={ss.inp}
              value={form.postcode || ""}
              onChange={(e) => set("postcode", e.target.value)}
              onBlur={(e) => {
                const normalised = resolveUkPostcodeInput(e.target.value);
                if (normalised && normalised !== form.postcode) set("postcode", normalised);
              }}
              placeholder="e.g. KT22 7SH or KT227SH"
              autoComplete="postal-code"
            />
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)", marginTop: 4, marginBottom: 4 }}>
              Enter a UK postcode, then use Lookup coordinates. Weather + nearest A&amp;E feeds RAMS and emergency contacts.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label style={ss.lbl}>Latitude (optional)</label>
                <input style={ss.inp} inputMode="decimal" value={form.lat ?? ""} onChange={(e) => set("lat", e.target.value)} placeholder="e.g. 51.5" />
              </div>
              <div>
                <label style={ss.lbl}>Longitude (optional)</label>
                <input style={ss.inp} inputMode="decimal" value={form.lng ?? ""} onChange={(e) => set("lng", e.target.value)} placeholder="e.g. -0.12" />
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button type="button" style={ss.btn} disabled={geoBusy} onClick={geocode}>
                {geoBusy ? "Looking up…" : "Lookup coordinates"}
              </button>
              <button type="button" style={ss.btnP} disabled={enrichBusy} onClick={enrichSite}>
                {enrichBusy ? "Fetching…" : "Weather + nearest A&E"}
              </button>
              {geoMsg && <span style={{ fontSize: 12, color: "#b45309" }}>{geoMsg}</span>}
            </div>
            {(form.weatherSnapshot || form.nearestHospital) && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#f0fdfa", border: "0.5px solid #99f6e4", fontSize: 12, lineHeight: 1.45 }}>
                {form.weatherSnapshot ? <div style={{ marginBottom: 6 }}><strong>Weather:</strong> {form.weatherSnapshot}</div> : null}
                {form.nearestHospital ? (
                  <div>
                    <strong>Nearest A&E:</strong> {form.nearestHospital}
                    {form.hospitalDirectionsUrl ? (
                      <>
                        {" "}
                        <a href={form.hospitalDirectionsUrl} target="_blank" rel="noreferrer" style={{ color: "#0d9488" }}>
                          Directions
                        </a>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border-tertiary,#e2e8f0)" }}>
              <label style={ss.lbl}>Site boundary (KML)</label>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)", marginBottom: 8 }}>
                Import a polygon from survey/GIS — shown on the site map and incident hotspot map.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <label style={{ ...ss.btn, cursor: "pointer", margin: 0 }}>
                  {kmlBusy ? "Importing…" : "Import KML boundary"}
                  <input
                    type="file"
                    accept=".kml,.kmz,application/vnd.google-earth.kml+xml,text/xml"
                    hidden
                    disabled={kmlBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importKmlBoundary(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {boundaryRing ? (
                  <button type="button" style={ss.btn} onClick={clearBoundary}>
                    Clear boundary ({boundaryRing.length} pts)
                  </button>
                ) : null}
              </div>
              {form.boundaryName ? (
                <div style={{ fontSize: 12, marginTop: 8, color: "var(--color-text-secondary)" }}>
                  Loaded: {form.boundaryName}
                  {form.boundarySource ? ` · ${form.boundarySource}` : ""}
                </div>
              ) : null}
              <ProjectSitePreviewMap
                lat={form.lat}
                lng={form.lng}
                boundaryRing={boundaryRing}
                escapeRoutes={form.mapEscapeRoutes || []}
                label={form.name || "Site preview"}
              />
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  style={{ ...ss.btn, fontSize: 12 }}
                  onClick={() => {
                    setWorkspaceNavTarget({ viewId: "project-drawings", projectId: form.id });
                    openWorkspaceView({ viewId: "project-drawings" });
                  }}
                >
                  Open plan markup (PDF / escape routes)
                </button>
              </div>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label style={ss.lbl}>Target start</label>
                <input type="date" style={ss.inp} value={form.timelineStart || ""} onChange={(e) => set("timelineStart", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Target end</label>
                <input type="date" style={ss.inp} value={form.timelineEnd || ""} onChange={(e) => set("timelineEnd", e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button type="button" style={ss.btnP} disabled={forecastBusy} onClick={fetchStartForecast}>
                {forecastBusy ? "Fetching…" : "Weather forecast for start date"}
              </button>
              {geoMsg && step === 4 ? <span style={{ fontSize: 12, color: "#b45309" }}>{geoMsg}</span> : null}
            </div>
            {form.weatherAtStartSnapshot ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#eff6ff", border: "0.5px solid #bfdbfe", fontSize: 12 }}>
                <strong>Start-date forecast</strong> ({form.weatherAtStartDate || form.timelineStart}): {form.weatherAtStartSnapshot}
              </div>
            ) : null}
            <label style={{ ...ss.lbl, marginTop: 10 }}>Risk hints (editable)</label>
            <textarea
              style={{ ...ss.inp, minHeight: 84, resize: "vertical" }}
              value={(form.riskRegister || []).join("\n")}
              onChange={(e) =>
                set(
                  "riskRegister",
                  e.target.value
                    .split(/\r?\n/)
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .slice(0, 12)
                )
              }
              placeholder="One risk per line"
            />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <label style={{ ...ss.lbl, marginTop: 4 }}>Project playbook</label>
            <p style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)", margin: "0 0 8px" }}>
              One click on save: creates RAMS, survey, PTW and method statement drafts for this site type.
            </p>
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              {PROJECT_PLAYBOOKS.map((pb) => (
                <label
                  key={pb.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border:
                      form.playbookId === pb.id
                        ? "1px solid #0d9488"
                        : "1px solid var(--color-border-tertiary,#e5e5e5)",
                    background: form.playbookId === pb.id ? "#E1F5EE" : "var(--color-background-primary,#fff)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="playbookId"
                    checked={form.playbookId === pb.id}
                    onChange={() => {
                      const playbook = getPlaybook(pb.id);
                      setForm((f) => ({
                        ...f,
                        playbookId: pb.id,
                        industryStarter: playbook.industryStarter || f.industryStarter,
                        permitDefaults: {
                          ...(f.permitDefaults || {}),
                          requiredPermitTypes: playbook.permitTypes || f.permitDefaults?.requiredPermitTypes,
                        },
                      }));
                    }}
                  />
                  <span>
                    <strong style={{ display: "block", fontSize: 13 }}>{pb.label}</strong>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{pb.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>Starter:</strong> {starterMeta.label}
            </div>
            <label style={{ ...ss.lbl, marginTop: 10 }}>Required permit types (one per line)</label>
            <textarea
              style={{ ...ss.inp, minHeight: 72, resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              value={(form.permitDefaults?.requiredPermitTypes || starterMeta.defaultPermitFlow || []).join("\n")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  permitDefaults: {
                    ...(f.permitDefaults || {}),
                    requiredPermitTypes: e.target.value
                      .split(/\r?\n/)
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .slice(0, 12),
                  },
                }))
              }
              placeholder="hot_work&#10;excavation&#10;electrical"
            />
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)", marginTop: 4 }}>
              Used by dashboard and Permits to track missing PTWs for this site.
            </div>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <strong>Missing before go-live:</strong>{" "}
              {missing.length === 0 ? (
                <span style={{ color: "#27500A" }}>none</span>
              ) : (
                <span style={{ color: "#791F1F" }}>{missing.join(", ")}</span>
              )}
            </div>
            <div style={{ marginTop: 10, border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Generated startup checklist</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                {buildStartupChecklist(form).slice(0, 8).map((it) => (
                  <li key={it.id}>{it.text}</li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10, lineHeight: 1.45 }}>
          Wizard stores project defaults for permits and gives readiness insight before launch.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={ss.btn} onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step <= 1}>
              Back
            </button>
            <button type="button" style={ss.btn} onClick={() => setStep((s) => Math.min(totalSteps, s + 1))} disabled={step >= totalSteps}>
              Next
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={ss.btn} onClick={onClose}>
              Cancel
            </button>
            <button type="button" style={ss.btnO} onClick={() => persist({ openDrawingEditor: true })}>
              Save + drawing editor
            </button>
            <button type="button" style={ss.btnP} onClick={persist}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
