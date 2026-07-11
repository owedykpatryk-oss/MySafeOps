/**
 * Apply FESS job starters to RAMS drafts (org-exclusive).
 */
import { getFessBaselineHazardIds, getFessJobStarter, resolveFessStarterHazards } from "./fessJobStarters";
import { isFessOrg } from "./fessOrg";
import { canUseFessExclusiveFeatures } from "./fessExclusive";

/**
 * @param {string} starterKey
 * @param {object} [project]
 */
export function buildFessJobStarterFormPatch(starterKey, project = null) {
  if (!canUseFessExclusiveFeatures()) return null;
  const starter = getFessJobStarter(starterKey);
  if (!starter) return null;

  const year = new Date().getFullYear();
  const tail = String(Math.floor(Math.random() * 900)).padStart(3, "0");
  const jobRef = `${starter.jobRefPrefix}-${year}-${tail}`;

  return {
    title: starter.title,
    scope: starter.scope,
    surveyMethodStatement: starter.methodStatement,
    jobRef,
    client: project?.client || starter.client,
    location: project?.location || project?.address || starter.siteHint,
    fessJobStarterKey: starter.key,
    fessJobStarterLabel: starter.label,
    communicationPlan: [
      "Daily briefing before start; stop-work via FESS supervisor.",
      "Permit coordination with site permit controller.",
      "Line clearance / LOTO confirmed before intrusive work.",
      "",
      "Suggested permits:",
      ...starter.permitTypes.map((t) => `- ${t.replace(/_/g, " ")}`),
    ].join("\n"),
    handoverNotes:
      "Handover includes test/validation records, debris clearance confirmation, and permit close-out sign-off.",
  };
}

/**
 * @param {string} starterKey
 * @param {object[]} library
 * @param {string} [siteTemplateId]
 */
export function getHazardsForFessJobStarter(starterKey, library, siteTemplateId = "") {
  if (!isFessOrg()) return [];
  return resolveFessStarterHazards(starterKey, library, siteTemplateId);
}

/** Standard site RA baseline rows for a FESS site (preferred pack + site extras). */
export function getFessSiteBaselineHazards(library, siteTemplateId = "") {
  if (!isFessOrg()) return [];
  const ids = new Set(getFessBaselineHazardIds(siteTemplateId));
  return (library || []).filter((h) => ids.has(h.id));
}

/** Standard site RA baseline rows only (~21 M&E hazards). */
export function getFessMeBaselineHazards(library) {
  return getFessSiteBaselineHazards(library, "");
}
