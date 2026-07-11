/**
 * FESS Group — site-level quick actions (pack, portal link, briefing).
 */
import { loadOrgScoped as load } from "./orgStorage";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { ensureFessSiteProject } from "./fessClientSites";
import { findProjectForFessSite } from "./fessClientHub";
import { getFessPortalForSite } from "./fessPortalPreset";
import { openFessSitePackWindow } from "./fessSitePack";
import { copyTextToClipboard } from "./copyToClipboard";
import { openWorkspaceView, setWorkspaceNavTarget } from "./workspaceNavContext";
import { seedFessSiteBriefing } from "./fessBriefingRecord";

/**
 * @param {object} portal
 */
export function buildFessPortalUrl(portal) {
  if (!portal?.token || typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}?portal=${portal.token}`;
}

/**
 * @param {string} siteTemplateId
 */
export function getLatestFessSiteRams(siteTemplateId, projects = [], rams = []) {
  const project = findProjectForFessSite(siteTemplateId, projects) || ensureFessSiteProject(siteTemplateId);
  if (!project) return null;
  const siteRams = (Array.isArray(rams) ? rams : [])
    .filter((r) => r.projectId === project.id)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
  return siteRams[0] || null;
}

/**
 * Open FESS Site Pack PDF for latest RAMS on site.
 * @param {string} siteTemplateId
 */
export async function openFessSitePackForSite(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, message: "FESS site pack is only available for FESS Group workspace." };
  }

  const projects = load("mysafeops_projects", []);
  const rams = load("rams_builder_docs", []);
  const workers = load("mysafeops_workers", []);
  const permits = load("permits_v2", []);
  const ramsDoc = getLatestFessSiteRams(siteTemplateId, projects, rams);

  if (!ramsDoc) {
    return { ok: false, reason: "no_rams", message: "No RAMS on this site yet — start a full job pack first." };
  }

  const project = findProjectForFessSite(siteTemplateId, projects);
  const forProject = permits.filter((p) => p.projectId === project?.id);
  const opened = await openFessSitePackWindow(ramsDoc, ramsDoc.rows || [], workers, projects, {
    permits: forProject,
    print: false,
  });

  return opened
    ? { ok: true, message: `FESS site pack opened — ${ramsDoc.documentNo || ramsDoc.title}` }
    : { ok: false, message: "Could not open print window — allow pop-ups." };
}

/**
 * @param {string} siteTemplateId
 */
export async function copyFessPortalLinkForSite(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, message: "FESS portals are only available for FESS Group workspace." };
  }
  const portal = getFessPortalForSite(siteTemplateId);
  if (!portal) {
    return { ok: false, message: "No portal for this site — run Seed site portals first." };
  }
  const url = buildFessPortalUrl(portal);
  const copied = await copyTextToClipboard(url);
  return copied
    ? { ok: true, url, message: "Portal link copied — send to site permit controller." }
    : { ok: false, url, message: "Copy failed — open Client portal and copy manually." };
}

/**
 * @param {string} siteTemplateId
 */
export function openFessSiteBriefing(siteTemplateId) {
  const result = seedFessSiteBriefing(siteTemplateId);
  if (!result.ok) return result;
  const project = ensureFessSiteProject(siteTemplateId);
  setWorkspaceNavTarget({ viewId: "daily-briefing", projectId: project?.id, briefingId: result.briefing?.id });
  openWorkspaceView({ viewId: "daily-briefing" });
  return result;
}
