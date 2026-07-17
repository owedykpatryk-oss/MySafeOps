/**
 * Copy site context from project / linked RAMS onto a survey or GPR draft.
 */
import { getSiteContextOverlay, formatSiteContextBriefing } from "../modules/rams/ramsSiteContextOverlays.js";
import { siteContextBadgeLabel } from "../modules/rams/ramsPlaybookEnrichment.js";

/**
 * @param {object} doc
 * @param {object | null | undefined} project
 * @param {object | null | undefined} ramsDoc
 */
export function inheritSiteContextOntoDoc(doc, project, ramsDoc = null) {
  if (!doc || typeof doc !== "object") return doc;
  const key =
    String(doc.siteContextKey || "").trim() ||
    String(ramsDoc?.siteContextKey || "").trim() ||
    String(project?.siteContextKey || "").trim();
  if (!key) return doc;
  const overlay = getSiteContextOverlay(key);
  const label =
    String(doc.siteContextLabel || "").trim() ||
    String(ramsDoc?.siteContextLabel || "").trim() ||
    String(project?.siteContextLabel || "").trim() ||
    overlay?.label ||
    siteContextBadgeLabel({ siteContextKey: key }) ||
    key;
  const next = { ...doc, siteContextKey: key, siteContextLabel: label };
  if (overlay && Object.prototype.hasOwnProperty.call(next, "accessLimitationsNotes") && !String(next.accessLimitationsNotes || "").trim()) {
    next.accessLimitationsNotes = formatSiteContextBriefing(overlay);
  }
  // GPR: seed acquisition notes once if empty
  if (overlay && next.acquisition && typeof next.acquisition === "object") {
    const notes = String(next.acquisition.notes || "").trim();
    if (!notes) {
      next.acquisition = {
        ...next.acquisition,
        notes: `Site context — ${overlay.shortLabel}: ${overlay.description}`,
      };
    }
  }
  return next;
}

export { siteContextBadgeLabel };
