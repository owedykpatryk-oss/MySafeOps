import { useState, useEffect, useMemo } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import {
  applyAndPersistProjectPlaybook,
  getPlaybook,
} from "../utils/projectPlaybooks";
import { getPlaybooksForOrg } from "../utils/projectHubIndustry";
import { isSuperAdminEmail } from "../utils/superAdmin";
import { billingLimitMessage, checkBillingLimit } from "../utils/billingLimits";
import ConfirmDialog from "../components/ConfirmDialog";
import { ms } from "../utils/moduleStyles";
import { geocodeAddressNominatim, geocodeCountryLabel } from "../utils/geocode";
import { getCompetencyCardHint, getEmergencyServicesLabel, getPostcodeHint } from "../utils/marketLabels";
import { getOrgMarketId } from "../utils/orgMarket";
import {
  geoLookupSuccessMsg,
  lookupSitePostcode,
  resolveSitePostcodeInput,
  sitePostcodeExample,
} from "../utils/siteAddressLookup";
import EmptyState from "../components/EmptyState";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { getOrgId, loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import { sanitizeProjectForOrg } from "../utils/fessExclusive";
import {
  getCertLibraryForMarket,
  certLabel,
  addMonthsIso,
  normalizeWorkerCertifications,
  getWorkerCertAlerts,
} from "../utils/certifications";
import { pushRecycleBinItem } from "../utils/recycleBin";
import { openWorkspaceView, setWorkspaceNavTarget, consumeWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { getNearestHospital } from "../utils/nearestHospital";
import { fetchWeatherSummary, fetchWeatherForDate } from "../utils/weatherSummary";
import { boundaryFromKmlGeometry, parseKmlGeometry } from "./permits/projectDrawingImport";
import { parseProjectBoundaryRing, centroidFromBoundaryRing } from "../utils/projectBoundary";
import ProjectSitePreviewMap from "../components/ProjectSitePreviewMap";
import ProjectKmlDropZone from "../components/ProjectKmlDropZone";
import ConfettiCelebration from "../components/ConfettiCelebration";
import ProjectDashboard from "../components/ProjectDashboard";
import {
  buildProjectActionContext,
  pickNextActionForProject,
  openProjectNextAction,
} from "../utils/projectNextAction";
import { isAutomationEnabled } from "../utils/orgAutomationRules";
import { cloneProjectDocuments } from "../utils/documentPropagation";
import { getOrgSettings } from "../utils/orgSettingsStorage";
import {
  applySoloProjectRoles,
  buildSoloWorkerSeed,
  buildStartupChecklist,
  deriveUserDisplayName,
  inferSoloMode,
  projectHealthScore,
  projectMissingItems,
} from "../utils/soloWorkspace";

const WORKERS_KEY = "mysafeops_workers";
const PROJECTS_KEY = "mysafeops_projects";
const PROJECT_WIZARD_DRAFT_KEY = "project_wizard_draft";
const PROJECT_WIZARD_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
    hint: "New build, refurbishment, mixed trades",
    icon: "🏗️",
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
    hint: "Occupied buildings, fire alarm isolations, out-of-hours works",
    icon: "🏢",
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
    hint: "Roads, drainage, utilities, heavy plant segregation",
    icon: "🛤️",
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
    hint: "LOTO, residual energy, handback and permit escalation",
    icon: "🔧",
    defaultPermitFlow: ["loto", "electrical", "hot_work", "confined_space"],
    starterChecklist: [
      "Create lockout/tagout authority matrix",
      "Confirm shutdown boundary and handback",
      "Define permit escalation contacts",
    ],
    riskHints: ["residual energy", "restart hazards", "restricted access"],
  },
];

const PROJECT_WIZARD_STEPS = [
  { id: 1, short: "Basics", title: "Name your project", lead: "Give the site a clear name and client reference for RAMS, permits and the project hub." },
  { id: 2, short: "Team", title: "Team and industry", lead: "Pick a starter pack for permit defaults and tell us who owns HSE on site." },
  { id: 3, short: "Location", title: "Where is the site?", lead: "Postcode or KML boundary — the map updates automatically and feeds weather and nearest A&E." },
  { id: 4, short: "Timeline", title: "Schedule and risks", lead: "Set target dates, pull a start-date forecast, and tune industry risk hints." },
  { id: 5, short: "Launch", title: "Ready to go live", lead: "Choose a playbook, confirm permit defaults, and review readiness before save." },
];

function wizardStepBlockers(step, form, soloMode) {
  const missing = [];
  if (step === 1) {
    if (!String(form?.name || "").trim()) missing.push("project name");
    if (!String(form?.site || "").trim()) missing.push("site / client");
  }
  if (step === 2) {
    if (soloMode) {
      if (!String(form?.soloLeadName || form?.owner || "").trim()) missing.push("your name / role");
    } else {
      if (!String(form?.owner || "").trim()) missing.push("project owner");
      if (!String(form?.hseLead || "").trim()) missing.push("HSE lead");
    }
  }
  if (step === 3) {
    const hasAddress = Boolean(String(form?.address || "").trim());
    if (!hasAddress && !projectHasSiteLocation(form)) {
      missing.push("address or site location (postcode / KML)");
    }
  }
  return missing;
}

function projectHasSiteCoords(form) {
  const lat = parseFloat(String(form?.lat ?? "").trim());
  const lng = parseFloat(String(form?.lng ?? "").trim());
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function projectHasSiteLocation(form) {
  if (projectHasSiteCoords(form)) return true;
  const ring = parseProjectBoundaryRing(form);
  return Array.isArray(ring) && ring.length >= 3;
}

function formatSiteLocationSummary(form) {
  const address = String(form?.address || "").trim();
  const postcode = String(form?.postcode || "").trim();
  if (address && postcode) return `${address}, ${postcode}`;
  if (address) return address;
  if (postcode) return postcode;
  const ring = parseProjectBoundaryRing(form);
  if (Array.isArray(ring) && ring.length >= 3) {
    const name = String(form?.boundaryName || "").trim() || "KML site boundary";
    return `${name} (${ring.length} points)`;
  }
  if (projectHasSiteCoords(form)) {
    const lat = parseFloat(String(form.lat ?? "").trim());
    const lng = parseFloat(String(form.lng ?? "").trim());
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  return "";
}

function formatWizardDraftAge(savedAt) {
  if (!savedAt) return "recently";
  const ms = Date.now() - new Date(savedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "recently";
  const mins = Math.round(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function loadProjectWizardDraft() {
  const draft = loadOrgScoped(PROJECT_WIZARD_DRAFT_KEY, null);
  if (!draft || typeof draft !== "object" || !draft.form) return null;
  const savedAt = draft.savedAt ? new Date(draft.savedAt).getTime() : 0;
  if (savedAt && Date.now() - savedAt > PROJECT_WIZARD_DRAFT_TTL_MS) {
    saveOrgScoped(PROJECT_WIZARD_DRAFT_KEY, null, { bypassBillingGuard: true });
    return null;
  }
  return draft;
}

function saveProjectWizardDraft(payload) {
  saveOrgScoped(
    PROJECT_WIZARD_DRAFT_KEY,
    { ...payload, savedAt: new Date().toISOString() },
    { bypassBillingGuard: true }
  );
}

function clearProjectWizardDraft() {
  saveOrgScoped(PROJECT_WIZARD_DRAFT_KEY, null, { bypassBillingGuard: true });
}

function wizardFormHasDraftContent(form) {
  return Boolean(
    String(form?.name || "").trim() ||
      String(form?.site || "").trim() ||
      String(form?.address || "").trim() ||
      String(form?.postcode || "").trim() ||
      projectHasSiteLocation(form)
  );
}

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

    saved = sanitizeProjectForOrg(saved, getOrgId());

    setProjects((prev) => {
      const i = prev.findIndex((x) => x.id === saved.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = saved;
        return next;
      }
      return [saved, ...prev];
    });

    if (saved.soloMode !== false && workers.length === 0) {
      const workerGate = checkBillingLimit("workers", billingOpts);
      if (workerGate.ok) {
        const seed = buildSoloWorkerSeed(user, getOrgSettings(), genId);
        if (seed) {
          setWorkers((prev) => (prev.length > 0 ? prev : [seed, ...prev]));
          pushToast(`Solo profile added: ${seed.name} — use this for briefings, PTW and signatures.`, "success");
        }
      }
    }

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
          workers={workers}
          user={user}
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
          <EmptyState
            icon="📍"
            title="No projects yet"
            description="Add a site, pick a playbook on save, then open the project hub for RAMS, survey and permit drafts."
            actionLabel="+ Add first project"
            onAction={tryAddProject}
            variant="dashed"
            compact
          />
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
  const certLibrary = getCertLibraryForMarket(getOrgMarketId());
  const baseMatrix = Object.fromEntries(
    certLibrary.map((c) => [
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
  const orgMarketId = getOrgMarketId();
  const certLibrary = getCertLibraryForMarket(orgMarketId);
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
      const lib = certLibrary.find((x) => x.code === code);
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
        certType: certLabel(code, orgMarketId),
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

  const visibleCatalog = certLibrary.filter((c) => c.label.toLowerCase().includes(certFilter.trim().toLowerCase()));

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
        <input style={ss.inp} value={form.certType || ""} onChange={(e) => set("certType", e.target.value)} placeholder={getCompetencyCardHint(getOrgMarketId())} />
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

function projectFormShape(p, { workers = [], user, orgSettings } = {}) {
  const soloDefault = inferSoloMode(p, workers);
  const leadDefault = deriveUserDisplayName(user, orgSettings);
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
      soloMode: soloDefault,
      soloLeadName: leadDefault,
      owner: leadDefault,
      hseLead: leadDefault,
      siteManager: leadDefault,
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
      playbookId: "general",
    };
  }
  return {
    ...p,
    lat: p.lat != null && p.lat !== "" ? String(p.lat) : "",
    lng: p.lng != null && p.lng !== "" ? String(p.lng) : "",
    postcode: p.postcode || "",
    industryStarter: p.industryStarter || inferProjectStarter(p),
    soloMode: inferSoloMode(p, workers),
    soloLeadName: p.soloLeadName || p.owner || leadDefault,
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

function ProjectForm({ item, workers = [], user, onSave, onClose }) {
  const orgSettings = useMemo(() => getOrgSettings(), []);
  const orgMarketId = getOrgMarketId();
  const initialDraft = useMemo(() => (!item?.id ? loadProjectWizardDraft() : null), [item?.id]);
  const [form, setForm] = useState(() =>
    projectFormShape(initialDraft?.form || item, { workers, user, orgSettings })
  );
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [kmlBusy, setKmlBusy] = useState(false);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [showAdvancedCoords, setShowAdvancedCoords] = useState(false);
  const [previewBasemap, setPreviewBasemap] = useState("streets");
  const [step, setStep] = useState(() => {
    const draftStep = Number(initialDraft?.step);
    return draftStep >= 1 && draftStep <= 5 ? draftStep : 1;
  });
  const [draftRestored, setDraftRestored] = useState(Boolean(initialDraft?.form));
  const [celebrateReady, setCelebrateReady] = useState(false);
  const totalSteps = 5;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const soloMode = form.soloMode !== false;
  const missing = projectMissingItems(form, { soloMode });
  const health = projectHealthScore(form, { soloMode });
  const starterMeta = PROJECT_STARTERS.find((p) => p.id === form.industryStarter) || PROJECT_STARTERS[0];
  const playbooks = useMemo(() => getPlaybooksForOrg(), []);
  const boundaryRing = parseProjectBoundaryRing(form);
  const stepMeta = PROJECT_WIZARD_STEPS[step - 1] || PROJECT_WIZARD_STEPS[0];
  const stepBlockers = wizardStepBlockers(step, form, soloMode);
  const siteLocationReady = projectHasSiteLocation(form);
  const siteLocationLabel = formatSiteLocationSummary(form);

  const applyResolvedCoords = (resolved) => {
    if (!resolved?.changed) return;
    setForm((f) => ({
      ...f,
      lat: String(resolved.lat),
      lng: String(resolved.lng),
      postcode: resolved.postcode ?? f.postcode,
      address: resolved.address ?? f.address,
    }));
  };

  const ensureSiteCoordinates = async (draft = form) => {
    const lat = parseFloat(String(draft.lat ?? "").trim());
    const lng = parseFloat(String(draft.lng ?? "").trim());
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, postcode: draft.postcode, address: draft.address, changed: false };
    }

    const postcodeQuery = resolveSitePostcodeInput(draft.postcode, draft.address, draft.site);
    if (postcodeQuery) {
      const pc = await lookupSitePostcode(postcodeQuery, orgMarketId);
      if (pc) {
        return {
          lat: pc.lat,
          lng: pc.lng,
          postcode: pc.postcode,
          address: draft.address?.trim()
            ? draft.address
            : [pc.adminDistrict, pc.region].filter(Boolean).join(", "),
          changed: true,
        };
      }
    }

    const ring = parseProjectBoundaryRing(draft);
    const centroid = ring ? centroidFromBoundaryRing(ring) : null;
    if (centroid) {
      return {
        lat: centroid.lat,
        lng: centroid.lng,
        postcode: draft.postcode,
        address: draft.address,
        changed: true,
      };
    }

    return { lat: null, lng: null, postcode: draft.postcode, address: draft.address, changed: false };
  };

  const lookupPostcodeOnBlur = async (rawPostcode) => {
    const lat = parseFloat(String(form.lat ?? "").trim());
    const lng = parseFloat(String(form.lng ?? "").trim());
    if (Number.isFinite(lat) && Number.isFinite(lng)) return;

    const postcodeQuery = resolveSitePostcodeInput(rawPostcode, form.address, form.site);
    if (!postcodeQuery) return;

    setGeoBusy(true);
    setGeoMsg("");
    try {
      const resolved = await ensureSiteCoordinates({ ...form, postcode: postcodeQuery });
      if (resolved.changed) {
        applyResolvedCoords(resolved);
        setGeoMsg(geoLookupSuccessMsg(orgMarketId));
      }
    } catch (e) {
      setGeoMsg(e?.message || "Postcode lookup failed.");
    } finally {
      setGeoBusy(false);
    }
  };

  const goNext = async () => {
    let nextForm = form;
    if (step === 3) {
      setGeoBusy(true);
      setGeoMsg("");
      try {
        const resolved = await ensureSiteCoordinates(form);
        if (resolved.changed) {
          nextForm = {
            ...form,
            lat: String(resolved.lat),
            lng: String(resolved.lng),
            postcode: resolved.postcode ?? form.postcode,
            address: resolved.address ?? form.address,
          };
          applyResolvedCoords(resolved);
          setGeoMsg(geoLookupSuccessMsg(orgMarketId));
        }
      } catch (e) {
        setGeoMsg(e?.message || "Could not resolve site coordinates.");
      } finally {
        setGeoBusy(false);
      }
    }
    const blockers = wizardStepBlockers(step, nextForm, soloMode);
    if (blockers.length > 0) {
      if (step === 3) {
        setGeoMsg(`Complete location first: ${blockers.join(", ")}.`);
      }
      return;
    }
    setStep((s) => Math.min(totalSteps, s + 1));
  };

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
      const centroid = centroidFromBoundaryRing(boundary.boundaryPoints);
      setForm((f) => {
        const hasCoords =
          Number.isFinite(parseFloat(String(f.lat ?? "").trim())) &&
          Number.isFinite(parseFloat(String(f.lng ?? "").trim()));
        const hasAddress = Boolean(String(f.address ?? "").trim());
        return {
          ...f,
          ...boundary,
          boundaryImportedAt: new Date().toISOString(),
          mapEscapeRoutes: (geom.lineStrings || []).map((line, idx) => ({
            id: `mer_${Date.now()}_${idx}`,
            name: line.name || `Route ${idx + 1}`,
            points: line.points.map((p) => ({ lat: p.lat, lng: p.lng })),
          })),
          ...(hasCoords || !centroid
            ? {}
            : { lat: String(centroid.lat), lng: String(centroid.lng) }),
          ...(!hasAddress && boundary.boundaryName
            ? { address: boundary.boundaryName }
            : {}),
        };
      });
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
    const postcodeQuery = resolveSitePostcodeInput(form.postcode, form.address, form.site);
    const start = String(form.timelineStart || "").trim().slice(0, 10);
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && postcodeQuery) {
      const pc = await lookupSitePostcode(postcodeQuery, orgMarketId);
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
    if (item?.id) {
      setForm(projectFormShape(item, { workers, user, orgSettings }));
      setStep(1);
      setDraftRestored(false);
      return;
    }
    const draft = loadProjectWizardDraft();
    if (draft?.form) {
      setForm(projectFormShape(draft.form, { workers, user, orgSettings }));
      const draftStep = Number(draft.step);
      setStep(draftStep >= 1 && draftStep <= 5 ? draftStep : 1);
      setDraftRestored(true);
      return;
    }
    setForm(projectFormShape(null, { workers, user, orgSettings }));
    setStep(1);
    setDraftRestored(false);
  }, [item?.id, user?.id]);

  useEffect(() => {
    if (item?.id || !wizardFormHasDraftContent(form)) return undefined;
    const t = window.setTimeout(() => {
      saveProjectWizardDraft({ form, step });
    }, 500);
    return () => window.clearTimeout(t);
  }, [form, step, item?.id]);

  useEffect(() => {
    if (step === 5 && health >= 100 && missing.length === 0) {
      setCelebrateReady(true);
    }
  }, [step, health, missing.length]);

  const discardDraft = () => {
    clearProjectWizardDraft();
    setForm(projectFormShape(null, { workers, user, orgSettings }));
    setStep(1);
    setDraftRestored(false);
    setGeoMsg("Draft discarded.");
  };

  const handleClose = () => {
    if (!item?.id && wizardFormHasDraftContent(form)) {
      saveProjectWizardDraft({ form, step });
    }
    onClose();
  };

  const applyAutoSuggest = () => {
    const nextStarter = inferProjectStarter(form);
    const starter = PROJECT_STARTERS.find((p) => p.id === nextStarter) || PROJECT_STARTERS[0];
    const lead = deriveUserDisplayName(user, orgSettings);
    setForm((f) => {
      const solo = f.soloMode !== false;
      const next = {
        ...f,
        industryStarter: nextStarter,
        riskRegister: suggestProjectRisks({ ...f, industryStarter: nextStarter }),
        permitDefaults: {
          ...(f.permitDefaults || {}),
          requiredPermitTypes: starter.defaultPermitFlow,
        },
      };
      if (solo) {
        return applySoloProjectRoles(next, f.soloLeadName || lead);
      }
      return {
        ...next,
        owner: f.owner || lead,
        hseLead: f.hseLead || "HSE lead",
      };
    });
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
    const draftBase = form.soloMode !== false ? applySoloProjectRoles(form, form.soloLeadName || deriveUserDisplayName(user, orgSettings)) : form;
    const draft = {
      ...draftBase,
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
    const nextMissing = projectMissingItems(draft, { soloMode: draft.soloMode !== false });
    const nextHealth = projectHealthScore(draft, { soloMode: draft.soloMode !== false });
    onSave({
      ...draft,
      lat: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
      lng: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
      healthScore: nextHealth,
      healthMissing: nextMissing,
      startupChecklist:
        Array.isArray(draft.startupChecklist) && draft.startupChecklist.length > 0
          ? draft.startupChecklist.slice(0, 30)
          : buildStartupChecklist(draft, { soloMode: draft.soloMode !== false, preset: starter }),
    }, {
      ...options,
      applyPlaybook: !item?.id ? draft.playbookId : options.applyPlaybook,
    });
    if (!item?.id) clearProjectWizardDraft();
  };

  const geocode = async () => {
    const postcodeQuery = resolveSitePostcodeInput(form.postcode, form.address, form.site);
    const q = [postcodeQuery || form.postcode, form.address, form.site].filter(Boolean).join(", ").trim();
    if (!q) {
      setGeoMsg("Enter postcode or address first.");
      return;
    }
    setGeoBusy(true);
    setGeoMsg("");
    try {
      if (postcodeQuery) {
        const pc = await lookupSitePostcode(postcodeQuery, orgMarketId);
        if (pc) {
          setForm((f) => ({
            ...f,
            lat: String(pc.lat),
            lng: String(pc.lng),
            postcode: pc.postcode,
            address: f.address?.trim() ? f.address : [pc.adminDistrict, pc.region].filter(Boolean).join(", "),
          }));
          setGeoMsg(geoLookupSuccessMsg(orgMarketId));
          return;
        }
        setGeoMsg(`Postcode "${postcodeQuery}" not found — check spelling or try a fuller address.`);
        return;
      }
      const c = await geocodeAddressNominatim(`${q}, ${geocodeCountryLabel(orgMarketId)}`, orgMarketId);
      if (!c) {
        setGeoMsg(
          orgMarketId === "au"
            ? "No coordinates found — try an Australian postcode (e.g. 2000) or fuller address."
            : orgMarketId === "pl"
            ? "No coordinates found — try a Polish postcode (e.g. 00-001) or fuller address."
            : "No coordinates found — try a UK postcode (e.g. KT22 7SH) or fuller address."
        );
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
    const postcodeQuery = resolveSitePostcodeInput(form.postcode, form.address, form.site);
    setEnrichBusy(true);
    setGeoMsg("");
    try {
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && postcodeQuery) {
        const pc = await lookupSitePostcode(postcodeQuery, orgMarketId);
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

  const fetchSiteData = async () => {
    setEnrichBusy(true);
    setGeoBusy(true);
    setGeoMsg("");
    try {
      const resolved = await ensureSiteCoordinates(form);
      let lat = resolved.lat;
      let lng = resolved.lng;
      if (resolved.changed) {
        applyResolvedCoords(resolved);
      } else if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        lat = parseFloat(String(form.lat ?? "").trim(), 10);
        lng = parseFloat(String(form.lng ?? "").trim(), 10);
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setGeoMsg("Enter a postcode or import a KML boundary first.");
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
      const bits = ["coordinates"];
      if (weather) bits.push("weather");
      if (hospital) bits.push(`nearest ${getEmergencyServicesLabel(orgMarketId)}`);
      setGeoMsg(`Updated: ${bits.join(", ")}.`);
    } catch (e) {
      setGeoMsg(e?.message || "Site data fetch failed.");
    } finally {
      setEnrichBusy(false);
      setGeoBusy(false);
    }
  };

  const wizardMap = (
    <ProjectSitePreviewMap
      lat={form.lat}
      lng={form.lng}
      boundaryRing={boundaryRing}
      escapeRoutes={form.mapEscapeRoutes || []}
      label={form.name || "Site preview"}
      height={step >= 3 ? 280 : 220}
      showLegend
      basemap={previewBasemap}
      onBasemapChange={setPreviewBasemap}
      showBasemapToggle
      animateZoom
      onKmlDrop={step === 3 ? importKmlBoundary : undefined}
      kmlDropBusy={kmlBusy}
    />
  );

  return (
    <div className="project-wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="project-wizard-title">
      <ConfettiCelebration
        active={celebrateReady}
        label="Project ready to go live"
        onDone={() => setCelebrateReady(false)}
      />
      <div className={`project-wizard-panel${step >= 3 ? " project-wizard-panel--wide" : ""}`} style={ss.card}>
        <div className="project-wizard-header">
          <div>
            <h2 id="project-wizard-title" className="project-wizard-header__title">
              {item ? "Edit project" : "New project"}
            </h2>
            <p className="project-wizard-header__subtitle">
              Step {step} of {totalSteps} · {stepMeta.short}
            </p>
          </div>
          <button type="button" className="project-wizard-header__auto" style={ss.btn} onClick={applyAutoSuggest}>
            Auto-suggest
          </button>
        </div>

        <div className="project-wizard-progress" aria-label="Wizard progress">
          {PROJECT_WIZARD_STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`project-wizard-progress__step${s.id === step ? " project-wizard-progress__step--active" : ""}${s.id < step ? " project-wizard-progress__step--done" : ""}`}
              onClick={() => {
                if (s.id < step) setStep(s.id);
              }}
              disabled={s.id > step}
              aria-current={s.id === step ? "step" : undefined}
              title={s.title}
            >
              <span className="project-wizard-progress__dot">{s.id < step ? "✓" : s.id}</span>
              <span className="project-wizard-progress__label">{s.short}</span>
            </button>
          ))}
        </div>

        <div className="project-wizard-health">
          <div className="project-wizard-health__meta">
            <span className="project-wizard-health__label">Readiness</span>
            <span className={`project-wizard-health__score project-wizard-health__score--${health >= 80 ? "good" : health >= 50 ? "mid" : "low"}`}>
              {health}%
            </span>
          </div>
          <div className="project-wizard-health__bar" aria-hidden>
            <div className="project-wizard-health__fill" style={{ width: `${health}%` }} />
          </div>
        </div>

        <div className="project-wizard-step-intro">
          <h3 className="project-wizard-step-intro__title">{stepMeta.title}</h3>
          <p className="project-wizard-step-intro__lead">{stepMeta.lead}</p>
        </div>

        {!item?.id && draftRestored ? (
          <div className="project-wizard-draft-banner" role="status">
            <span>
              Restored unsaved draft ({formatWizardDraftAge(initialDraft?.savedAt)})
            </span>
            <button type="button" className="project-wizard-link-btn" onClick={discardDraft}>
              Discard draft
            </button>
          </div>
        ) : null}

        {stepBlockers.length > 0 ? (
          <div className="project-wizard-alert" role="status">
            Complete before continuing: {stepBlockers.join(", ")}
          </div>
        ) : null}

        {step < 3 ? (
          <div className="project-wizard-body">
            {step === 1 ? (
              <div className="project-wizard-section">
                <label style={ss.lbl}>Project name</label>
                <input style={ss.inp} value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
                <label style={{ ...ss.lbl, marginTop: 10 }}>Site / client</label>
                <input style={ss.inp} value={form.site} onChange={(e) => set("site", e.target.value)} />
              </div>
            ) : null}

            {step === 2 ? (
              <>
                <div className="project-wizard-section">
                  <div style={ss.lbl}>Industry starter</div>
                  <div className="project-wizard-industry-grid">
                    {PROJECT_STARTERS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`project-wizard-industry-card${form.industryStarter === preset.id ? " project-wizard-industry-card--active" : ""}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            industryStarter: preset.id,
                            permitDefaults: { ...(f.permitDefaults || {}), requiredPermitTypes: preset.defaultPermitFlow },
                          }))
                        }
                      >
                        <span className="project-wizard-industry-card__icon" aria-hidden>{preset.icon}</span>
                        <span className="project-wizard-industry-card__title">{preset.label}</span>
                        <span className="project-wizard-industry-card__hint">{preset.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="project-wizard-section">
                  <label className="project-wizard-solo-toggle">
                    <input
                      type="checkbox"
                      checked={soloMode}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const lead = form.soloLeadName || deriveUserDisplayName(user, orgSettings);
                        setForm((f) =>
                          checked
                            ? applySoloProjectRoles({ ...f, soloMode: true }, lead)
                            : { ...f, soloMode: false }
                        );
                      }}
                    />
                    <span>
                      <strong>Solo site — just me on this job</strong>
                      <span className="project-wizard-solo-toggle__hint">
                        One person can be project owner, HSE lead and permit approver.
                      </span>
                    </span>
                  </label>
                  {soloMode ? (
                    <>
                      <label style={{ ...ss.lbl, marginTop: 10 }}>Your name and role</label>
                      <input
                        style={ss.inp}
                        value={form.soloLeadName || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => applySoloProjectRoles({ ...f, soloLeadName: v }, v));
                        }}
                        placeholder="e.g. Pat O — Principal contractor / HSE"
                      />
                    </>
                  ) : (
                    <>
                      <label style={{ ...ss.lbl, marginTop: 10 }}>Project owner</label>
                      <input style={ss.inp} value={form.owner || ""} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. PM / contract manager" />
                      <label style={{ ...ss.lbl, marginTop: 10 }}>HSE lead</label>
                      <input style={ss.inp} value={form.hseLead || ""} onChange={(e) => set("hseLead", e.target.value)} />
                      <label style={{ ...ss.lbl, marginTop: 10 }}>Site manager</label>
                      <input style={ss.inp} value={form.siteManager || ""} onChange={(e) => set("siteManager", e.target.value)} />
                      <label style={{ ...ss.lbl, marginTop: 10 }}>Main contractor lead</label>
                      <input style={ss.inp} value={form.contractorLead || ""} onChange={(e) => set("contractorLead", e.target.value)} />
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="project-wizard-layout">
            <div className="project-wizard-main">
              {step === 3 ? (
                <>
                  <div className="project-wizard-section">
                    <div className="project-wizard-section__head">
                      <h4 className="project-wizard-section__title">Address and postcode</h4>
                      {siteLocationReady ? (
                        <span className="project-wizard-status project-wizard-status--ok">Site located</span>
                      ) : (
                        <span className="project-wizard-status">Awaiting location</span>
                      )}
                    </div>
                    <label style={ss.lbl}>Address</label>
                    <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.address} onChange={(e) => set("address", e.target.value)} />
                    <label style={{ ...ss.lbl, marginTop: 10 }}>Postcode</label>
                    <input
                      style={ss.inp}
                      value={form.postcode || ""}
                      onChange={(e) => set("postcode", e.target.value)}
                      onBlur={(e) => {
                        const normalised = resolveSitePostcodeInput(e.target.value);
                        if (normalised && normalised !== form.postcode) set("postcode", normalised);
                        lookupPostcodeOnBlur(normalised || e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const normalised = resolveSitePostcodeInput(form.postcode);
                        if (normalised && normalised !== form.postcode) set("postcode", normalised);
                        lookupPostcodeOnBlur(normalised || form.postcode);
                      }}
                      placeholder={`e.g. ${sitePostcodeExample(orgMarketId)}`}
                      autoComplete="postal-code"
                    />
                    {siteLocationReady ? (
                      <p className="project-wizard-location-resolved">
                        <span className="project-wizard-location-resolved__pin" aria-hidden>📍</span>
                        {siteLocationLabel || "Site location set"}
                      </p>
                    ) : null}
                    <p className="project-wizard-hint">
                      {getPostcodeHint(orgMarketId)} Map, weather and nearest {getEmergencyServicesLabel(orgMarketId)} use these details.
                    </p>
                    <div className="project-wizard-actions">
                      <button type="button" style={ss.btnP} disabled={enrichBusy || geoBusy} onClick={fetchSiteData}>
                        {enrichBusy || geoBusy ? "Fetching site data…" : "Fetch site data"}
                      </button>
                      <button
                        type="button"
                        className="project-wizard-link-btn"
                        onClick={() => setShowAdvancedCoords((v) => !v)}
                        aria-expanded={showAdvancedCoords}
                      >
                        {showAdvancedCoords ? "Hide advanced" : "Advanced coordinates"}
                      </button>
                    </div>
                    {geoMsg ? <p className="project-wizard-msg">{geoMsg}</p> : null}
                    {showAdvancedCoords ? (
                      <div className="project-wizard-advanced">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <label style={ss.lbl}>Latitude</label>
                            <input style={ss.inp} inputMode="decimal" value={form.lat ?? ""} onChange={(e) => set("lat", e.target.value)} placeholder="e.g. 51.5" />
                          </div>
                          <div>
                            <label style={ss.lbl}>Longitude</label>
                            <input style={ss.inp} inputMode="decimal" value={form.lng ?? ""} onChange={(e) => set("lng", e.target.value)} placeholder="e.g. -0.12" />
                          </div>
                        </div>
                        <div className="project-wizard-actions" style={{ marginTop: 8 }}>
                          <button type="button" style={ss.btn} disabled={geoBusy} onClick={geocode}>
                            {geoBusy ? "Looking up…" : "Lookup coordinates only"}
                          </button>
                          <button type="button" style={ss.btn} disabled={enrichBusy} onClick={enrichSite}>
                            {enrichBusy ? "Fetching…" : "Weather + A&E only"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {(form.weatherSnapshot || form.nearestHospital) && (
                      <div className="project-wizard-enrich-card">
                        {form.weatherSnapshot ? <div><strong>Weather:</strong> {form.weatherSnapshot}</div> : null}
                        {form.nearestHospital ? (
                          <div>
                            <strong>Nearest A&E:</strong> {form.nearestHospital}
                            {form.hospitalDirectionsUrl ? (
                              <>
                                {" "}
                                <a href={form.hospitalDirectionsUrl} target="_blank" rel="noreferrer">Directions</a>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="project-wizard-section">
                    <h4 className="project-wizard-section__title">Site boundary (KML)</h4>
                    <p className="project-wizard-hint">Import a polygon from survey/GIS — shown on the site map and incident hotspot map.</p>
                    <ProjectKmlDropZone
                      onFile={importKmlBoundary}
                      busy={kmlBusy}
                      buttonLabel="Import KML boundary"
                      hint="Drop a .kml or .kmz site boundary here"
                    >
                      {boundaryRing ? (
                        <div className="project-wizard-kml-meta">
                          <span>
                            Loaded: {form.boundaryName || "Site boundary"}
                            {form.boundarySource ? ` · ${form.boundarySource}` : ""}
                            {" "}({boundaryRing.length} pts)
                          </span>
                          <button type="button" className="project-wizard-link-btn" onClick={clearBoundary}>
                            Clear boundary
                          </button>
                        </div>
                      ) : null}
                    </ProjectKmlDropZone>
                    <button
                      type="button"
                      className="project-wizard-link-btn"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setWorkspaceNavTarget({ viewId: "project-drawings", projectId: form.id });
                        openWorkspaceView({ viewId: "project-drawings" });
                      }}
                    >
                      Open plan markup (PDF / escape routes)
                    </button>
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className="project-wizard-section">
                    <h4 className="project-wizard-section__title">Target dates</h4>
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
                    <div className="project-wizard-actions" style={{ marginTop: 10 }}>
                      <button type="button" style={ss.btnP} disabled={forecastBusy} onClick={fetchStartForecast}>
                        {forecastBusy ? "Fetching…" : "Weather forecast for start date"}
                      </button>
                    </div>
                    {geoMsg ? <p className="project-wizard-msg">{geoMsg}</p> : null}
                    {form.weatherAtStartSnapshot ? (
                      <div className="project-wizard-forecast-card">
                        <strong>Start-date forecast</strong> ({form.weatherAtStartDate || form.timelineStart}): {form.weatherAtStartSnapshot}
                      </div>
                    ) : null}
                  </div>
                  <div className="project-wizard-section">
                    <label style={ss.lbl}>Risk hints (editable)</label>
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
                  </div>
                </>
              ) : null}

              {step === 5 ? (
                <>
                  <div className="project-wizard-summary">
                    <h4 className="project-wizard-summary__title">Project summary</h4>
                    <dl className="project-wizard-summary__grid">
                      <div><dt>Project</dt><dd>{form.name || "—"}</dd></div>
                      <div><dt>Site / client</dt><dd>{form.site || "—"}</dd></div>
                      <div><dt>Location</dt><dd>{siteLocationLabel || "—"}</dd></div>
                      <div><dt>Industry</dt><dd>{starterMeta.label}</dd></div>
                      <div><dt>Timeline</dt><dd>{form.timelineStart && form.timelineEnd ? `${form.timelineStart} → ${form.timelineEnd}` : "—"}</dd></div>
                      <div><dt>Team</dt><dd>{soloMode ? (form.soloLeadName || "Solo mode") : [form.owner, form.hseLead].filter(Boolean).join(" · ") || "—"}</dd></div>
                    </dl>
                  </div>

                  <div className="project-wizard-section">
                    <label style={{ ...ss.lbl, marginTop: 4 }}>Project playbook</label>
                    <p className="project-wizard-hint">On save: creates RAMS, survey, PTW and method statement drafts for this site type.</p>
                    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                      {playbooks.map((pb) => (
                        <label
                          key={pb.id}
                          className={`project-wizard-playbook${form.playbookId === pb.id ? " project-wizard-playbook--active" : ""}`}
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
                            <strong>{pb.label}</strong>
                            <span className="project-wizard-playbook__desc">{pb.description}</span>
                          </span>
                        </label>
                      ))}
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
                    <div className="project-wizard-readiness">
                      <strong>Missing before go-live:</strong>{" "}
                      {missing.length === 0 ? (
                        <span className="project-wizard-readiness--ok">none{soloMode ? " · solo mode" : ""}</span>
                      ) : (
                        <span className="project-wizard-readiness--warn">{missing.join(", ")}</span>
                      )}
                    </div>
                    {missing.length === 0 ? (
                      <div className="project-wizard-ready-banner" role="status">
                        All required fields complete — save to create RAMS, survey and permit drafts.
                      </div>
                    ) : null}
                    {soloMode ? (
                      <p className="project-wizard-hint">Coordinates are recommended for weather and nearest A&E, but not required to save in solo mode.</p>
                    ) : null}
                    <div className="project-wizard-checklist">
                      <div className="project-wizard-checklist__title">Generated startup checklist</div>
                      <ul>
                        {buildStartupChecklist(form, { soloMode, preset: starterMeta }).slice(0, 8).map((it) => (
                          <li key={it.id}>{it.text}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <aside className="project-wizard-map-col">
              <div className="project-wizard-section project-wizard-section--map">
                <h4 className="project-wizard-section__title">Site map</h4>
                {wizardMap}
              </div>
            </aside>
          </div>
        )}

        <div className="project-wizard-footer">
          <div className="project-wizard-footer__nav">
            <button type="button" style={ss.btn} onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step <= 1}>
              Back
            </button>
            <button
              type="button"
              style={ss.btn}
              onClick={goNext}
              disabled={step >= totalSteps || geoBusy || stepBlockers.length > 0}
            >
              {geoBusy && step === 3 ? "Resolving site…" : "Next"}
            </button>
          </div>
          <div className="project-wizard-footer__save">
            <button type="button" style={ss.btn} onClick={handleClose}>
              {item?.id ? "Cancel" : "Close"}
            </button>
            {!item?.id ? (
              <span className="project-wizard-footer__draft-hint">Draft auto-saves</span>
            ) : null}
            <button type="button" style={ss.btnO} onClick={() => persist({ openDrawingEditor: true })}>Save + drawing editor</button>
            <button type="button" style={ss.btnP} onClick={persist}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
