import { collectProjectDashboard } from "./projectDashboard";
import { cleanMoney, normaliseManagementState } from "./managementOverview";

/**
 * The management job list: every project in the register, overlaid with the management
 * document's own scheduling decisions, plus pipeline opportunities.
 *
 * This lives outside the module because the background notification scan needs exactly the
 * same list. Two implementations would drift, and the one nobody looks at would drift first.
 */

/**
 * Readiness falls back to what the project register can prove when management has not
 * recorded its own answer yet.
 */
export function deriveReadiness(project, dash, jobConfig) {
  if (jobConfig?.readiness) return jobConfig.readiness;
  return {
    dates: Boolean(project.timelineStart && project.timelineEnd),
    team: Boolean(jobConfig?.teamId),
    rams: dash.rams.length > 0,
    permits: dash.permitReady.complete,
    survey: dash.surveys.length > 0,
    client: Boolean(project.client),
  };
}

/**
 * Project dashboards are the expensive part of this list, and the list is rebuilt whenever
 * anything in the management document changes. Cache per project object: as long as the
 * register itself has not been reloaded, editing a job status no longer re-scans every
 * project's RAMS, permits and surveys.
 */
const dashboardCache = new WeakMap();

function dashboardFor(project, workers) {
  const cached = dashboardCache.get(project);
  if (cached && cached.workers === workers) return cached.dash;
  const dash = collectProjectDashboard(project, workers);
  dashboardCache.set(project, { workers, dash });
  return dash;
}

/**
 * @param {object[]} projects Project register rows.
 * @param {object[]} workers Workers register rows.
 * @param {object} state Management document, or just its `{ jobs, opportunities }` slice.
 * @returns {object[]} Jobs and pipeline opportunities in planner shape.
 */
export function buildManagementJobs(projects = [], workers = [], state = {}) {
  const alreadyValid = Array.isArray(state?.opportunities) && state?.jobs && typeof state.jobs === "object";
  const doc = alreadyValid ? state : normaliseManagementState(state);

  const projectJobs = (Array.isArray(projects) ? projects : []).map((project) => {
    const config = doc.jobs[project.id] || {};
    const dash = dashboardFor(project, workers);
    return {
      id: project.id,
      name: project.name || "Unnamed project",
      client: project.client || "Client not set",
      site: project.site || project.address || project.postcode || "Location not set",
      start: config.start || project.timelineStart || "",
      end: config.end || project.timelineEnd || project.timelineStart || "",
      teamId: config.teamId || "",
      status: config.status || "provisional",
      value: cleanMoney(config.value),
      readiness: deriveReadiness(project, dash, config),
      source: "project",
      project,
      documentCounts: { rams: dash.rams.length, permits: dash.permits.length, surveys: dash.surveys.length },
    };
  });

  const opportunities = doc.opportunities.map((opportunity) => ({
    ...opportunity,
    readiness: opportunity.readiness || { dates: true, team: Boolean(opportunity.teamId), rams: false, permits: false, survey: false, client: false },
    status: opportunity.status || "provisional",
    source: "opportunity",
    documentCounts: { rams: 0, permits: 0, surveys: 0 },
  }));

  return [...projectJobs, ...opportunities];
}
