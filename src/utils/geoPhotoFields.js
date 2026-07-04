/**
 * Structured geo-photo fields — GI location IDs, depths, permit presets, capture phases.
 */

/** Types that show structured GI fields in capture modal. */
export const GEO_PHOTO_GI_TYPES = new Set([
  "trial_pit",
  "borehole_location",
  "window_sampling",
  "dcp_probe",
  "hand_auger_point",
  "sample_custody",
  "borehole_cap",
  "piezometer_install",
]);

export const CAPTURE_PHASE_OPTIONS = [
  { key: "", label: "— Not specified —" },
  { key: "before", label: "Pre-works / before exposure" },
  { key: "after", label: "Post-reinstatement / after works" },
];

/** Suggested preset when opening capture from a permit type. */
export const PERMIT_GEO_PHOTO_PRESETS = {
  excavation: "trial_pit",
  ground_disturbance: "buried_services_warning",
  confined_space: "manhole_chamber",
  marine_hydrographic: "site_entrance",
  aerial_survey_coordination: "orientation_wide_shot",
  rail_corridor_access: "site_entrance",
  general: "hazard",
  hot_work: "hazard",
  lifting: "hazard",
};

/** Suggested preset from project playbook. */
export const PLAYBOOK_GEO_PHOTO_PRESETS = {
  site_investigation: "borehole_location",
  utility_mapping: "utility_locator",
  groundworks: "trial_pit",
  utilities_water: "manhole_chamber",
  utilities_street: "traffic_management",
};

export function isGiGeoPhotoType(type) {
  return GEO_PHOTO_GI_TYPES.has(String(type || ""));
}

export function suggestedGeoPhotoPresetForPermit(permitType) {
  return PERMIT_GEO_PHOTO_PRESETS[String(permitType || "").toLowerCase()] || "general_site_condition";
}

export function suggestedGeoPhotoPresetForPlaybook(playbookId) {
  return PLAYBOOK_GEO_PHOTO_PRESETS[String(playbookId || "")] || "site_entrance";
}

/** Parse location ID from free-text notes (fallback). */
export function parseLocationIdFromNotes(notes, fallbackPrefix = "GI") {
  const t = String(notes || "");
  const m =
    t.match(/\b(BH|TP|WS|DCP|HA|PZ|S)[\s_-]?(\d{1,3})\b/i) ||
    t.match(/\b(loc(?:ation)?|point|id)\s*[:.]?\s*([A-Z]{1,4}[\s_-]?\d{1,3})\b/i);
  if (m) {
    if (m[2] && /^[A-Z]/i.test(m[2])) return String(m[2]).replace(/\s/g, "").toUpperCase();
    return `${m[1].toUpperCase()}${m[2]}`;
  }
  return "";
}

export function parseDepthMFromNotes(notes) {
  const t = String(notes || "");
  const m =
    t.match(/(?:depth|approx\.?\s*depth|@|bgl)\s*[:.]?\s*(\d+(?:\.\d+)?)\s*m\b/i) ||
    t.match(/\b(\d+(?:\.\d+)?)\s*m\b(?:\s*(?:deep|depth|bgl))?/i);
  return m ? Number(m[1]) : null;
}

export function formatDepthDisplay(depthM) {
  if (depthM == null || depthM === "" || Number.isNaN(Number(depthM))) return "";
  return `${Number(depthM)} m`;
}

export function resolvedGiLocationId(photo) {
  const id = String(photo?.locationId || "").trim();
  if (id) return id.toUpperCase().replace(/\s/g, "");
  return parseLocationIdFromNotes(photo?.notes) || "";
}

export function resolvedGiDepth(photo) {
  if (photo?.depthM != null && photo.depthM !== "" && !Number.isNaN(Number(photo.depthM))) {
    return formatDepthDisplay(photo.depthM);
  }
  const parsed = parseDepthMFromNotes(photo?.notes);
  return parsed != null ? formatDepthDisplay(parsed) : "";
}

/** Merge structured GI fields into notes for backward-compatible search/export. */
export function buildStructuredGeoPhotoNotes({ notes = "", locationId = "", depthM = null, sampleRef = "", capturePhase = "" } = {}) {
  const parts = [String(notes || "").trim()];
  const loc = String(locationId || "").trim();
  if (loc) parts.push(loc.toUpperCase());
  const depth = formatDepthDisplay(depthM);
  if (depth) parts.push(`depth ${depth}`);
  const sample = String(sampleRef || "").trim();
  if (sample) parts.push(`sample ${sample}`);
  const phase = CAPTURE_PHASE_OPTIONS.find((p) => p.key === capturePhase)?.label;
  if (capturePhase && phase) parts.push(`phase: ${phase}`);
  return parts.filter(Boolean).join(" · ");
}

export function permitHasSiteEvidence(permit) {
  return Boolean(permit?.evidencePhotoUrl || permit?.evidencePhotoStoragePath || permit?.evidenceGeoPhotoId);
}
