/**
 * FESS Group — client & site directory with one-click job pack launch (org-exclusive).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { FESS_CLIENT_SITE_TEMPLATES, ensureFessSiteProject } from "./fessClientSites";
import { getFessJobStarter } from "./fessJobStarters";
import { applyAndPersistProjectPlaybook } from "./projectPlaybooks";
import { openWorkspaceView, setWorkspaceNavTarget } from "./workspaceNavContext";
import { computeRamsFingerprint } from "../modules/rams/ramsPrintHtml";
import { todayLocalISO } from "./localDate";

const RAMS_KEY = "rams_builder_docs";
const PROJECTS_KEY = "mysafeops_projects";

const genId = () => `rams_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * @param {import("./fessJobStarters").FessJobStarter | null | undefined} [starter]
 */
export function generateFessJobRef(starter) {
  const prefix = String(starter?.jobRefPrefix || "FESS-JOB").trim();
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${year}-${seq}`;
}

/**
 * @param {string} siteTemplateId
 * @param {object[]} projects
 */
export function findProjectForFessSite(siteTemplateId, projects = []) {
  const id = String(siteTemplateId || "").trim();
  if (!id) return null;
  const list = Array.isArray(projects) ? projects : [];
  return (
    list.find((p) => p.fessSiteTemplateId === id) ||
    list.find((p) => {
      const tmpl = FESS_CLIENT_SITE_TEMPLATES.find((t) => t.id === id);
      return tmpl && String(p.name || "").trim().toLowerCase() === tmpl.name.toLowerCase();
    }) ||
    null
  );
}

/**
 * @param {string} projectId
 * @param {object[]} rams
 * @param {object[]} permits
 * @param {object[]} methodStatements
 */
export function getFessSiteDocStats(projectId, rams = [], permits = [], methodStatements = []) {
  const pid = String(projectId || "").trim();
  if (!pid) {
    return {
      ramsCount: 0,
      draftRams: 0,
      activePermits: 0,
      lineClearanceOpen: 0,
      msCount: 0,
      latestRams: null,
      hasFullPack: false,
    };
  }
  const projectRams = (Array.isArray(rams) ? rams : []).filter((r) => r.projectId === pid);
  const projectPermits = (Array.isArray(permits) ? permits : []).filter((p) => p.projectId === pid);
  const projectMs = (Array.isArray(methodStatements) ? methodStatements : []).filter((ms) => ms.projectId === pid);
  const isActivePermit = (p) => ["active", "issued", "open"].includes(String(p.status || "").toLowerCase());
  const activePermits = projectPermits.filter(isActivePermit).length;
  const lineClearanceOpen = projectPermits.filter(
    (p) => isActivePermit(p) && (p.permitType === "line_clearance" || p.type === "line_clearance")
  ).length;
  const draftRams = projectRams.filter((r) => String(r.status || "draft").toLowerCase() === "draft").length;
  const latestRams = projectRams.length
    ? [...projectRams].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      )[0]
    : null;
  return {
    ramsCount: projectRams.length,
    draftRams,
    activePermits,
    lineClearanceOpen,
    msCount: projectMs.length,
    latestRams,
    hasFullPack: projectRams.length > 0 && projectMs.length > 0 && projectPermits.length > 0,
  };
}

/**
 * @param {object} [ctx]
 * @param {object[]} [ctx.projects]
 * @param {object[]} [ctx.rams]
 * @param {object[]} [ctx.permits]
 * @param {object[]} [ctx.methodStatements]
 */
export function buildFessClientDirectory(ctx = {}) {
  if (!canUseFessExclusiveFeatures()) return [];
  const projects = Array.isArray(ctx.projects) ? ctx.projects : load(PROJECTS_KEY, []);
  const rams = Array.isArray(ctx.rams) ? ctx.rams : load(RAMS_KEY, []);
  const permits = Array.isArray(ctx.permits) ? ctx.permits : load("permits_v2", []);
  const methodStatements = Array.isArray(ctx.methodStatements) ? ctx.methodStatements : load("method_statements", []);

  const sites = FESS_CLIENT_SITE_TEMPLATES.map((tmpl) => {
    const project = findProjectForFessSite(tmpl.id, projects);
    const starter = getFessJobStarter(tmpl.suggestedJobStarterKey);
    const stats = project
      ? getFessSiteDocStats(project.id, rams, permits, methodStatements)
      : getFessSiteDocStats("", rams, permits, methodStatements);
    return {
      template: tmpl,
      project,
      starter,
      stats,
      ready: !!project,
    };
  });

  const byClient = new Map();
  for (const row of sites) {
    const client = row.template.client;
    if (!byClient.has(client)) byClient.set(client, []);
    byClient.get(client).push(row);
  }

  return [...byClient.entries()].map(([client, clientSites]) => ({
    client,
    sites: clientSites,
    siteCount: clientSites.length,
    readyCount: clientSites.filter((s) => s.ready).length,
  }));
}

/**
 * One-click RAMS + MS + PTW from MC-mapped playbook.
 * @param {string} siteTemplateId
 * @param {{ reapply?: boolean }} [options]
 */
export function launchFessSiteJobPack(siteTemplateId, options = {}) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, message: "FESS client sites are only available for FESS Group workspace." };
  }
  const tmpl = FESS_CLIENT_SITE_TEMPLATES.find((t) => t.id === siteTemplateId);
  if (!tmpl) return { ok: false, message: "Unknown FESS site template." };

  const project = ensureFessSiteProject(siteTemplateId);
  if (!project) return { ok: false, message: "Could not create or find site project." };

  const playbookId =
    (options.starterKey && getFessJobStarter(options.starterKey) ? `fess_${options.starterKey}` : "") ||
    tmpl.suggestedPlaybookId ||
    project.playbookId;
  if (!playbookId) {
    return { ok: false, message: "No playbook mapped for this site." };
  }

  let result = { applied: false, summary: [] };
  try {
    result = applyAndPersistProjectPlaybook(project, playbookId);
    if (result.project) {
      const projects = load(PROJECTS_KEY, []);
      const idx = projects.findIndex((p) => p.id === project.id);
      const merged = { ...project, ...result.project };
      if (idx >= 0) {
        projects[idx] = merged;
      } else {
        projects.unshift(merged);
      }
      save(PROJECTS_KEY, projects);
    }
  } catch (e) {
    return { ok: false, message: e?.message || "Playbook could not be applied." };
  }

  setWorkspaceNavTarget({ viewId: "rams", projectId: project.id });
  openWorkspaceView({ viewId: "rams" });

  const summary = result.summary?.length ? result.summary.join(" · ") : "";
  return {
    ok: true,
    project,
    result,
    message: result.applied
      ? `Job pack ready: ${summary}`
      : options.reapply
        ? "Documents already exist for this site — open RAMS to edit or duplicate."
        : "Site project ready — open RAMS to continue.",
  };
}

/**
 * Repeat visit — duplicate latest RAMS for site with new FESS job ref.
 * @param {string} siteTemplateId
 */
export function duplicateFessRamsForSite(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, message: "FESS repeat job is only available for FESS Group workspace." };
  }
  const tmpl = FESS_CLIENT_SITE_TEMPLATES.find((t) => t.id === siteTemplateId);
  if (!tmpl) return { ok: false, message: "Unknown FESS site template." };

  const project = ensureFessSiteProject(siteTemplateId);
  if (!project) return { ok: false, message: "Could not find site project." };

  const ramsList = load(RAMS_KEY, []);
  const siteRams = ramsList
    .filter((r) => r.projectId === project.id)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );

  if (!siteRams.length) {
    return { ok: false, reason: "no_rams", message: "No RAMS on this site yet — start a full job pack first." };
  }

  const source = siteRams[0];
  const starter = getFessJobStarter(tmpl.suggestedJobStarterKey || source.fessJobStarterKey);
  const jobRef = generateFessJobRef(starter);
  const { shareToken: _st, contentHash: _ch, id: _oid, rows: srcRows, ...rest } = source;
  const rows = JSON.parse(JSON.stringify(srcRows || []));
  const now = new Date().toISOString();
  const copy = {
    ...rest,
    id: genId(),
    title: source.title || tmpl.name,
    documentNo: jobRef,
    jobRef,
    issueDate: todayLocalISO(),
    rows,
    status: "draft",
    isFavorite: false,
    fessJobStarterKey: starter?.key || source.fessJobStarterKey,
    fessJobStarterLabel: starter?.label || source.fessJobStarterLabel,
    permitControllerName: tmpl.permitControllerHint || source.permitControllerName,
    createdAt: now,
    updatedAt: now,
    shareToken: undefined,
    contentHash: undefined,
  };
  copy.contentHash = computeRamsFingerprint(copy, rows);
  save(RAMS_KEY, [copy, ...ramsList]);

  setWorkspaceNavTarget({ viewId: "rams", projectId: project.id, ramsId: copy.id });
  openWorkspaceView({ viewId: "rams" });

  return {
    ok: true,
    ramsId: copy.id,
    projectId: project.id,
    jobRef,
    message: `Repeat job RAMS created — ${jobRef}`,
  };
}

/**
 * @param {string} siteTemplateId
 */
export function openFessSiteProject(siteTemplateId) {
  const project = ensureFessSiteProject(siteTemplateId);
  if (!project) return { ok: false };
  setWorkspaceNavTarget({ viewId: "projects", projectId: project.id, action: "viewProjectDashboard" });
  openWorkspaceView({ viewId: "projects" });
  return { ok: true, project };
}

/**
 * @param {string} siteTemplateId
 */
export function openFessSiteLineClearance(siteTemplateId) {
  const project = ensureFessSiteProject(siteTemplateId);
  if (!project) return { ok: false };
  setWorkspaceNavTarget({ viewId: "permits", projectId: project.id, permitType: "line_clearance" });
  openWorkspaceView({ viewId: "permits" });
  return { ok: true, project };
}
