/** Geo-photo type presets — capture UX, map colour, report grouping. */

export const GEO_PHOTO_GROUP_ORDER = [
  "Access & logistics",
  "Site constraints & safety",
  "Survey & utilities",
  "Ground investigation",
  "Site conditions",
  "General",
];

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

export function presetsByGroup() {
  const map = new Map();
  GEO_PHOTO_GROUP_ORDER.forEach((g) => map.set(g, []));
  GEO_PHOTO_PRESETS.forEach((p) => {
    if (!map.has(p.group)) map.set(p.group, []);
    map.get(p.group).push(p);
  });
  return GEO_PHOTO_GROUP_ORDER.map((g) => ({ group: g, presets: map.get(g) || [] })).filter((x) => x.presets.length);
}
