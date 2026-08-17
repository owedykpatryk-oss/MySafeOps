/** Geo-photo type presets — capture UX, map colour, report grouping. */

export const GEO_PHOTO_GROUP_ORDER = [
  "Access & logistics",
  "Site constraints & safety",
  "Survey & utilities",
  "Ground investigation",
  "Construction & works",
  "Demolition & asbestos",
  "Civils & earthworks",
  "Facilities & maintenance",
  "Environment & neighbours",
  "Quality & handover",
  "Food & pharma hygiene",
  "Site conditions",
  "General",
];

/**
 * Which workspace profiles each group belongs to, so a demolition crew is not scrolling past
 * piezometers to reach asbestos. `"*"` means every trade photographs this.
 * Ordering only — nothing is ever hidden, because the one photo somebody needs is always the
 * one their profile did not predict.
 */
export const GEO_PHOTO_GROUP_PACKS = {
  "Access & logistics": ["*"],
  "Site constraints & safety": ["*"],
  "Survey & utilities": ["surveyingGeodesy", "contractorPlusSurveying"],
  "Ground investigation": ["surveyingGeodesy", "contractorPlusSurveying", "civilEarthworks"],
  "Construction & works": [
    "generalContractor",
    "buildingTrades",
    "contractorPlusSurveying",
    "electricalContractor",
    "civilEarthworks",
  ],
  "Demolition & asbestos": ["demolitionStripout", "buildingTrades"],
  "Civils & earthworks": ["civilEarthworks", "generalContractor"],
  "Facilities & maintenance": ["facilitiesMaintenance", "electricalContractor"],
  "Environment & neighbours": ["*"],
  "Quality & handover": [
    "generalContractor",
    "buildingTrades",
    "contractorPlusSurveying",
    "surveyingGeodesy",
    "facilitiesMaintenance",
  ],
  "Food & pharma hygiene": ["foodPharma"],
  "Site conditions": ["*"],
  General: ["*"],
};

export const GEO_PHOTO_PRESETS = [
  { id: "site_entrance", label: "Site entrance / access", icon: "🚪", color: "#2563eb", group: "Access & logistics" },
  { id: "access_route", label: "Access route", icon: "➡️", color: "#0d9488", group: "Access & logistics" },
  { id: "traffic_management", label: "Traffic management", icon: "🚧", color: "#ea580c", group: "Access & logistics" },
  { id: "parked_vehicle", label: "Parked vehicle / obstruction", icon: "🚗", color: "#64748b", group: "Access & logistics" },
  { id: "locked_gate", label: "Locked gate / barrier", icon: "🔒", color: "#dc2626", group: "Access & logistics" },
  { id: "no_access", label: "No access", icon: "🚫", color: "#dc2626", group: "Site constraints & safety" },
  { id: "hazard", label: "Hazard", icon: "⚠️", color: "#ea580c", group: "Site constraints & safety" },
  { id: "obstruction", label: "Obstruction", icon: "🧱", color: "#b45309", group: "Site constraints & safety" },
  { id: "overhead_obstruction", label: "Overhead obstruction", icon: "🏗️", color: "#c2410c", group: "Site constraints & safety" },
  { id: "buried_services_warning", label: "Buried services warning", icon: "⚡", color: "#ca8a04", group: "Site constraints & safety" },
  { id: "gpr_setup", label: "GPR / scan setup", icon: "📡", color: "#7c3aed", group: "Survey & utilities" },
  { id: "utility_locator", label: "Utility / CAT locate", icon: "📍", color: "#0891b2", group: "Survey & utilities" },
  { id: "trial_pit", label: "Trial pit / exposure", icon: "⛏️", color: "#78350f", group: "Survey & utilities" },
  { id: "manhole_chamber", label: "Manhole / chamber", icon: "🕳️", color: "#475569", group: "Survey & utilities" },
  { id: "benchmark_control", label: "Benchmark / control", icon: "📐", color: "#0f766e", group: "Survey & utilities" },
  { id: "borehole_location", label: "Borehole location", icon: "🕳️", color: "#1e40af", group: "Ground investigation" },
  { id: "window_sampling", label: "Window sampling point", icon: "🔩", color: "#4338ca", group: "Ground investigation" },
  { id: "dcp_probe", label: "DCP / dynamic probe point", icon: "📍", color: "#7c2d12", group: "Ground investigation" },
  { id: "hand_auger_point", label: "Hand auger sample point", icon: "🪛", color: "#92400e", group: "Ground investigation" },
  { id: "sample_custody", label: "Sample / chain of custody", icon: "🧪", color: "#0e7490", group: "Ground investigation" },
  { id: "borehole_cap", label: "Borehole cap / abandonment", icon: "🔒", color: "#334155", group: "Ground investigation" },
  { id: "piezometer_install", label: "Piezometer / standpipe", icon: "📊", color: "#0369a1", group: "Ground investigation" },
  { id: "rebar_prepour", label: "Rebar / pre-pour check", icon: "🧰", color: "#0f766e", group: "Construction & works" },
  { id: "concrete_pour", label: "Concrete pour", icon: "🧱", color: "#78716c", group: "Construction & works" },
  { id: "excavation_support", label: "Excavation & support", icon: "🕳️", color: "#a16207", group: "Construction & works" },
  { id: "scaffold", label: "Scaffold / access structure", icon: "🪜", color: "#ca8a04", group: "Construction & works" },
  { id: "work_at_height", label: "Work at height / edge protection", icon: "🧗", color: "#dc2626", group: "Construction & works" },
  { id: "lifting_operation", label: "Lifting operation", icon: "🏗️", color: "#b45309", group: "Construction & works" },
  { id: "temporary_works", label: "Temporary works", icon: "🔧", color: "#7c3aed", group: "Construction & works" },
  { id: "material_delivery", label: "Delivery / material storage", icon: "📦", color: "#475569", group: "Construction & works" },
  { id: "welfare_facility", label: "Welfare / site setup", icon: "🚻", color: "#0891b2", group: "Construction & works" },
  { id: "damaged_equipment", label: "Damaged / defective equipment", icon: "🛠️", color: "#dc2626", group: "Construction & works" },
  { id: "suspected_acm", label: "Suspected asbestos (ACM)", icon: "☣️", color: "#dc2626", group: "Demolition & asbestos" },
  { id: "asbestos_works", label: "Asbestos removal / enclosure", icon: "🧯", color: "#b91c1c", group: "Demolition & asbestos" },
  { id: "exclusion_zone", label: "Exclusion zone", icon: "⛔", color: "#ea580c", group: "Demolition & asbestos" },
  { id: "dust_suppression", label: "Dust suppression", icon: "💨", color: "#0891b2", group: "Demolition & asbestos" },
  { id: "structural_weakening", label: "Structural weakening", icon: "🏚️", color: "#7f1d1d", group: "Demolition & asbestos" },
  { id: "waste_segregation", label: "Waste / skip segregation", icon: "♻️", color: "#16a34a", group: "Demolition & asbestos" },
  { id: "soft_strip_progress", label: "Soft strip progress", icon: "🔨", color: "#64748b", group: "Demolition & asbestos" },
  { id: "haul_route", label: "Haul route", icon: "🛻", color: "#92400e", group: "Civils & earthworks" },
  { id: "stockpile", label: "Stockpile / material heap", icon: "⛰️", color: "#a16207", group: "Civils & earthworks" },
  { id: "formation_level", label: "Formation / level check", icon: "📏", color: "#0f766e", group: "Civils & earthworks" },
  { id: "drainage_run", label: "Drainage run / pipe laying", icon: "🚰", color: "#0284c7", group: "Civils & earthworks" },
  { id: "compaction_test", label: "Compaction / plate test", icon: "🧪", color: "#7c2d12", group: "Civils & earthworks" },
  { id: "silt_control", label: "Silt / erosion control", icon: "🌊", color: "#0369a1", group: "Civils & earthworks" },
  { id: "asset_nameplate", label: "Asset / nameplate", icon: "🏷️", color: "#475569", group: "Facilities & maintenance" },
  { id: "maintenance_defect", label: "Defect / fault", icon: "🧰", color: "#dc2626", group: "Facilities & maintenance" },
  { id: "electrical_test_point", label: "Electrical / PAT point", icon: "🔌", color: "#ca8a04", group: "Facilities & maintenance" },
  { id: "fire_door", label: "Fire door / compartmentation", icon: "🚪", color: "#b91c1c", group: "Facilities & maintenance" },
  { id: "emergency_lighting", label: "Emergency lighting", icon: "💡", color: "#d97706", group: "Facilities & maintenance" },
  { id: "water_outlet", label: "Water outlet (legionella)", icon: "🚿", color: "#0891b2", group: "Facilities & maintenance" },
  { id: "roof_access", label: "Roof / gutter access", icon: "🏠", color: "#334155", group: "Facilities & maintenance" },
  { id: "meter_reading", label: "Meter reading", icon: "🔢", color: "#0f766e", group: "Facilities & maintenance" },
  { id: "pollution_incident", label: "Pollution / spill", icon: "🛢️", color: "#b91c1c", group: "Environment & neighbours" },
  { id: "watercourse", label: "Watercourse / drain", icon: "🏞️", color: "#0284c7", group: "Environment & neighbours" },
  { id: "monitoring_station", label: "Noise / dust monitoring", icon: "🎚️", color: "#6366f1", group: "Environment & neighbours" },
  { id: "ecology_feature", label: "Ecology / protected species", icon: "🦇", color: "#16a34a", group: "Environment & neighbours" },
  { id: "protected_tree", label: "Protected tree (TPO)", icon: "🌳", color: "#166534", group: "Environment & neighbours" },
  { id: "waste_flytipping", label: "Waste / fly-tipping", icon: "🗑️", color: "#64748b", group: "Environment & neighbours" },
  { id: "neighbour_interface", label: "Neighbour / public interface", icon: "🏘️", color: "#ea580c", group: "Environment & neighbours" },
  { id: "snag_defect", label: "Snag / defect", icon: "📝", color: "#dc2626", group: "Quality & handover" },
  { id: "as_built_check", label: "As-built check", icon: "📐", color: "#0f766e", group: "Quality & handover" },
  { id: "sample_mockup", label: "Sample / mock-up approval", icon: "🎨", color: "#7c3aed", group: "Quality & handover" },
  { id: "commissioning", label: "Commissioning / test", icon: "⚙️", color: "#0891b2", group: "Quality & handover" },
  { id: "handover_condition", label: "Handover condition", icon: "🤝", color: "#16a34a", group: "Quality & handover" },
  { id: "hygiene_issue", label: "Hygiene issue", icon: "🧼", color: "#0891b2", group: "Food & pharma hygiene" },
  { id: "contamination_risk", label: "Contamination risk", icon: "🧫", color: "#b91c1c", group: "Food & pharma hygiene" },
  { id: "allergen_changeover", label: "Allergen changeover", icon: "🥜", color: "#ca8a04", group: "Food & pharma hygiene" },
  { id: "high_care_access", label: "High-care access", icon: "🥽", color: "#7c3aed", group: "Food & pharma hygiene" },
  { id: "pest_activity", label: "Pest activity", icon: "🐀", color: "#78350f", group: "Food & pharma hygiene" },
  { id: "cold_chain", label: "Cold chain / temperature", icon: "🌡️", color: "#0284c7", group: "Food & pharma hygiene" },
  { id: "ground_conditions", label: "Ground conditions", icon: "🌧️", color: "#854d0e", group: "Site conditions" },
  { id: "vegetation", label: "Vegetation / overgrowth", icon: "🌿", color: "#166534", group: "Site conditions" },
  { id: "drainage_water", label: "Drainage / standing water", icon: "💧", color: "#0284c7", group: "Site conditions" },
  { id: "orientation_wide_shot", label: "Orientation / wide shot", icon: "🌐", color: "#6366f1", group: "General" },
  { id: "general_site_condition", label: "General site condition", icon: "📷", color: "#64748b", group: "General" },
];

const BY_ID = Object.fromEntries(GEO_PHOTO_PRESETS.map((p) => [p.id, p]));

export function geoPhotoPreset(id) {
  return BY_ID[id] || BY_ID.general_site_condition;
}

export function geoPhotoPresetLabel(id) {
  return geoPhotoPreset(id).label;
}

/** Utility Mapping preferred capture order — shown first for that org only. */
export const UM_PREFERRED_GEO_PHOTO_IDS = [
  "site_entrance",
  "access_route",
  "buried_services_warning",
  "utility_locator",
  "gpr_setup",
  "manhole_chamber",
  "trial_pit",
  "benchmark_control",
  "traffic_management",
  "hazard",
  "orientation_wide_shot",
];

/**
 * Flat preset list for filters and pickers — the workspace's trade first, and for Utility
 * Mapping the survey types they actually shoot ahead of even that.
 * @param {boolean} [utilityMappingOrg]
 * @param {string} [packId] workspace industry pack
 */
export function listGeoPhotoPresetsForOrg(utilityMappingOrg = false, packId) {
  const ordered = presetsByGroup(packId).flatMap((entry) => entry.presets);
  if (!utilityMappingOrg) return ordered;
  const preferred = new Set(UM_PREFERRED_GEO_PHOTO_IDS);
  const head = UM_PREFERRED_GEO_PHOTO_IDS.map((id) => BY_ID[id]).filter(Boolean);
  return [...head, ...ordered.filter((p) => !preferred.has(p.id))];
}

/** Trades this group is for; unlisted groups are treated as everybody's. */
export function geoPhotoGroupPacks(group) {
  return GEO_PHOTO_GROUP_PACKS[group] || ["*"];
}

export function geoPhotoGroupMatchesPack(group, packId) {
  return geoPhotoGroupPacks(group).includes(String(packId || ""));
}

/**
 * Group order for a workspace: the trade's own groups first, then the ones everybody uses,
 * then the rest. Nothing is dropped — a builder who hits a manhole still needs the manhole type.
 */
export function geoPhotoGroupOrderForPack(packId) {
  const rank = (group) => {
    if (geoPhotoGroupMatchesPack(group, packId)) return 0;
    if (geoPhotoGroupPacks(group).includes("*")) return 1;
    return 2;
  };
  // showEverything asked for everything, so leave the catalogue in its natural order.
  if (!packId || packId === "showEverything") return [...GEO_PHOTO_GROUP_ORDER];
  return [...GEO_PHOTO_GROUP_ORDER].sort((a, b) => rank(a) - rank(b));
}

/**
 * Presets grouped for the capture UI.
 * @param {string} [packId] workspace industry pack, to bring that trade's groups to the top
 */
export function presetsByGroup(packId) {
  const map = new Map();
  GEO_PHOTO_GROUP_ORDER.forEach((g) => map.set(g, []));
  GEO_PHOTO_PRESETS.forEach((p) => {
    if (!map.has(p.group)) map.set(p.group, []);
    map.get(p.group).push(p);
  });
  return geoPhotoGroupOrderForPack(packId)
    .map((g) => ({ group: g, presets: map.get(g) || [] }))
    .filter((x) => x.presets.length);
}
