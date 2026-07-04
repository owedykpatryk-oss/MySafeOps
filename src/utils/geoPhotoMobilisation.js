/**
 * Pre-mobilisation geo-photo coverage — field checklist per project.
 */
import { geoPhotoPreset } from "./geoPhotoPresets";

export const MOBILISATION_MIN_REPORT_PHOTOS = 3;

/** @typedef {{ id: string, label: string, matchTypes?: string[], matchGroups?: string[], surveyOnly?: boolean }} MobilisationCheckDef */

/** @type {MobilisationCheckDef[]} */
export const MOBILISATION_CHECK_DEFS = [
  {
    id: "access",
    label: "Site entrance / access photographed",
    matchTypes: ["site_entrance", "access_route"],
  },
  {
    id: "traffic",
    label: "Access route + traffic management",
    matchTypes: ["access_route", "traffic_management"],
  },
  {
    id: "hazards",
    label: "Hazards / obstructions logged",
    matchGroups: ["Site constraints & safety"],
  },
  {
    id: "utilities",
    label: "Utility locate / GPR setup",
    matchTypes: [
      "utility_locator",
      "gpr_setup",
      "trial_pit",
      "manhole_chamber",
      "buried_services_warning",
    ],
    surveyOnly: true,
  },
  {
    id: "orientation",
    label: "Orientation wide shot",
    matchTypes: ["orientation_wide_shot"],
  },
  {
    id: "gi_clearance",
    label: "Utility clearance before GI (CAT / permit-to-dig)",
    matchTypes: ["buried_services_warning", "utility_locator", "gpr_setup"],
    giOnly: true,
  },
  {
    id: "gi_point",
    label: "GI intrusive point photographed",
    matchGroups: ["Ground investigation"],
    giOnly: true,
  },
  {
    id: "gi_reinstatement",
    label: "Borehole cap / pit reinstatement",
    matchTypes: ["borehole_cap", "trial_pit"],
    giOnly: true,
  },
];

function projectPhotos(photos, projectId) {
  if (!projectId) return [];
  return (Array.isArray(photos) ? photos : []).filter((p) => p.projectId === projectId);
}

function matchesCheck(photo, check) {
  if (check.matchTypes?.includes(photo.type)) return true;
  if (check.matchGroups?.includes(geoPhotoPreset(photo.type).group)) return true;
  return false;
}

/**
 * @param {object[]} photos
 * @param {string} projectId
 * @param {{ surveyPack?: boolean, minReportPhotos?: number }} [opts]
 */
export function buildGeoPhotoMobilisationChecklist(photos, projectId, opts = {}) {
  const { surveyPack = false, giPack = false, minReportPhotos = MOBILISATION_MIN_REPORT_PHOTOS } = opts;
  const list = projectPhotos(photos, projectId);
  const reportCount = list.filter((p) => p.includeInReport).length;

  const checks = MOBILISATION_CHECK_DEFS.filter((c) => {
    if (c.surveyOnly && !surveyPack) return false;
    if (c.giOnly && !giPack && !surveyPack) return false;
    return true;
  }).map((check) => ({
    id: check.id,
    label: check.label,
    done: list.some((p) => matchesCheck(p, check)),
  }));

  checks.push({
    id: "report_pack",
    label: `Min. ${minReportPhotos} photos marked “In report”`,
    done: reportCount >= minReportPhotos,
    count: reportCount,
    target: minReportPhotos,
  });

  const doneCount = checks.filter((c) => c.done).length;
  const total = checks.length;
  return {
    checks,
    doneCount,
    total,
    pct: total ? Math.round((doneCount / total) * 100) : 0,
    reportCount,
  };
}

/** Group coverage for mobilisation panel (types captured per preset group). */
export function geoPhotoGroupCoverage(photos, projectId) {
  const list = projectPhotos(photos, projectId);
  const byGroup = new Map();
  list.forEach((p) => {
    const group = geoPhotoPreset(p.type).group;
    if (!byGroup.has(group)) byGroup.set(group, 0);
    byGroup.set(group, byGroup.get(group) + 1);
  });
  return [...byGroup.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count);
}
