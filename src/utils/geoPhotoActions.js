/**
 * Outstanding actions raised from the field.
 *
 * Every photo type asks "Action required", and a tickbox nobody chases stops being ticked.
 * These helpers collect the open ones, rank them by how bad the site said they were, and turn
 * them into a list the office and the client can work through.
 */
import { geoPhotoPresetLabel } from "./geoPhotoPresets";
import { geoPhotoDetailSummary, normaliseGeoPhotoDetails } from "./geoPhotoTypeFields";

export const GEO_PHOTO_ACTIONS_MARKER = "=== Outstanding actions (field capture) ===";

const SEVERITY_RANK = { High: 3, Medium: 2, Low: 1 };

function answers(photo) {
  return normaliseGeoPhotoDetails(photo?.type, photo?.details);
}

/** Someone on site said this needs doing. */
export function geoPhotoRaisesAction(photo) {
  return answers(photo).actionRequired === true;
}

export function geoPhotoActionResolved(photo) {
  return Boolean(photo?.actionResolvedAt);
}

/** Raised on site and not yet closed off. */
export function geoPhotoActionOutstanding(photo) {
  return geoPhotoRaisesAction(photo) && !geoPhotoActionResolved(photo);
}

export function geoPhotoActionSeverity(photo) {
  return answers(photo).severity || "";
}

function photoTime(photo) {
  const t = new Date(photo?.timestampUtc || photo?.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Open actions, worst and oldest first — the order someone should work through them.
 * @param {object[]} photos
 * @param {string} [projectId] limit to one project when given
 */
export function outstandingGeoPhotoActions(photos, projectId = "") {
  return (Array.isArray(photos) ? photos : [])
    .filter((p) => p && !p.deletedAt && geoPhotoActionOutstanding(p))
    .filter((p) => !projectId || p.projectId === projectId)
    .sort((a, b) => {
      const rank = (SEVERITY_RANK[geoPhotoActionSeverity(b)] || 0) - (SEVERITY_RANK[geoPhotoActionSeverity(a)] || 0);
      if (rank !== 0) return rank;
      return photoTime(a) - photoTime(b);
    });
}

export function countOutstandingGeoPhotoActions(photos, projectId = "") {
  return outstandingGeoPhotoActions(photos, projectId).length;
}

/** Open actions per project, for badges on a project list. */
export function outstandingActionCountsByProject(photos) {
  const counts = {};
  for (const photo of outstandingGeoPhotoActions(photos)) {
    const key = photo.projectId || "";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/** Mark an action closed, or reopen it. */
export function setGeoPhotoActionResolved(photo, resolved, { by = "" } = {}) {
  if (!resolved) {
    return { ...photo, actionResolvedAt: null, actionResolvedBy: "", updatedAt: new Date().toISOString() };
  }
  const now = new Date().toISOString();
  return { ...photo, actionResolvedAt: now, actionResolvedBy: by || "", updatedAt: now };
}

/** One line describing an open action, e.g. "High — Hazard: Trip hazard (TQ 30125 80447)". */
export function geoPhotoActionLine(photo, { index = null, gridRef = "" } = {}) {
  const severity = geoPhotoActionSeverity(photo);
  const label = geoPhotoPresetLabel(photo?.type);
  const note = photo?.notes?.trim() ? `: ${photo.notes.trim()}` : "";
  // Severity leads the line and the flag is implied by being on the list at all.
  const summary = geoPhotoDetailSummary(photo, { exclude: ["severity", "actionRequired"] });
  const where = gridRef ? ` (${gridRef})` : "";
  const prefix = index != null ? `${index}. ` : "";
  const lead = severity ? `${severity} — ` : "";
  return `${prefix}${lead}${label}${note}${where}${summary ? ` [${summary}]` : ""}`;
}

/**
 * Marker-delimited block of open actions for a report section, or "" when there are none.
 * @param {object[]} photos already filtered to the project
 * @param {{ gridRefFor?: (photo: object) => string }} [opts]
 */
export function buildGeoPhotoActionsBlock(photos, opts = {}) {
  const open = outstandingGeoPhotoActions(photos);
  if (!open.length) return "";
  const lines = open.map((photo, i) =>
    geoPhotoActionLine(photo, { index: i + 1, gridRef: opts.gridRefFor?.(photo) || "" })
  );
  return `${GEO_PHOTO_ACTIONS_MARKER}\n${lines.join("\n")}`;
}
