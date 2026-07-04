/**
 * Construction & multi-sector activity catalogue — taxonomy from UK RAMS scope lists.
 * Used for sector browsing in the RAMS hazard picker and starter pack matching.
 */

/** @typedef {{ id: string, label: string, hazardTokens: string[], permitHints?: string[], certHints?: string[] }} CatalogActivity */
/** @typedef {{ id: string, label: string, activities: CatalogActivity[] }} CatalogSector */

/** @type {CatalogSector[]} */
export const CONSTRUCTION_ACTIVITY_CATALOG = [
  {
    id: "construction",
    label: "Construction & civils",
    activities: [
      { id: "site_clearance", label: "Site clearance & vegetation removal", hazardTokens: ["demolition", "vegetation", "manual handling", "slips", "trip"] },
      { id: "bulk_excavation", label: "Bulk excavation & cut/fill", hazardTokens: ["excavation", "dig", "collapse", "plant", "spoil"] },
      { id: "trial_holes", label: "Trial holes & vacuum excavation", hazardTokens: ["trial hole", "vacuum", "utility", "buried", "permit-to-dig"] },
      { id: "foundations", label: "Foundations & piling", hazardTokens: ["piling", "foundation", "concrete", "formwork", "vibration"] },
      { id: "scaffold", label: "Scaffold erection & use", hazardTokens: ["scaffold", "scaftag", "work at height", "fall"] },
      { id: "demolition", label: "Demolition & soft strip", hazardTokens: ["demolition", "strip-out", "asbestos", "collapse"] },
      { id: "temp_works", label: "Temporary works (props, shoring)", hazardTokens: ["temporary works", "shoring", "formwork", "collapse"] },
      { id: "concrete_pour", label: "Concrete pour & formwork", hazardTokens: ["concrete", "formwork", "manual handling", "silica"] },
      { id: "occupied_premises", label: "Works in occupied / live premises", hazardTokens: ["occupied", "refurb", "dust", "noise", "public"] },
      { id: "silica_dust", label: "Cutting / breaking (silica dust)", hazardTokens: ["silica", "dust", "cutting", "grinding", "ffp3"] },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    activities: [
      { id: "water_main", label: "Water main installation / repair", hazardTokens: ["water main", "excavation", "pressure", "chlorination"], permitHints: ["excavation"] },
      { id: "sewer_jetting", label: "Sewer jetting & CCTV", hazardTokens: ["jetting", "cctv", "manhole", "chamber", "confined"], permitHints: ["confined_space"] },
      { id: "gas_main", label: "Gas main / service connections", hazardTokens: ["gas", "purging", "pressure test", "excavation"], certHints: ["gas_safe"] },
      { id: "hv_cable", label: "HV cable jointing & substations", hazardTokens: ["hv", "substation", "cable", "arc", "electrical"], certHints: ["ecs"] },
      { id: "lv_street_light", label: "LV / street lighting", hazardTokens: ["electrical", "work at height", "traffic", "overhead"] },
      { id: "fibre_telecom", label: "Fibre blowing / duct / chamber", hazardTokens: ["fibre", "telecom", "duct", "chamber", "excavation"] },
      { id: "utility_mapping", label: "Utility mapping & PAS128", hazardTokens: ["utility", "pas128", "gpr", "eml", "buried"] },
    ],
  },
  {
    id: "surveying",
    label: "Surveying",
    activities: [
      { id: "topo_survey", label: "Topographical survey", hazardTokens: ["topographical", "slips", "trip", "uneven ground", "traffic"] },
      { id: "gpr_survey", label: "GPR survey", hazardTokens: ["gpr", "buried", "traffic", "manual handling"] },
      { id: "setting_out", label: "Setting out", hazardTokens: ["setting out", "traffic", "plant", "work at height"] },
      { id: "drone_survey", label: "UAV / drone survey", hazardTokens: ["drone", "uav", "overhead", "public"] },
      { id: "laser_scan", label: "Laser scanning / mobile mapping", hazardTokens: ["laser", "slam", "traffic", "trip"] },
      { id: "window_sampling", label: "Window sampling / trial pit (GI)", hazardTokens: ["window sampling", "trial pit", "excavation", "sample", "contamination"], permitHints: ["excavation", "ground_disturbance"] },
      { id: "gi_borehole", label: "Borehole / GI drilling", hazardTokens: ["borehole", "drilling", "ground investigation", "rotary", "coring"], permitHints: ["ground_disturbance", "excavation"] },
      { id: "dcp_probing", label: "DCP / dynamic probing", hazardTokens: ["dynamic probe", "dcp", "penetrometer", "blow count"], permitHints: ["ground_disturbance"] },
      { id: "hand_auger", label: "Hand auger / shallow sampling", hazardTokens: ["hand auger", "shallow", "manual handling", "sample"] },
      { id: "piezometer", label: "Piezometer / monitoring well", hazardTokens: ["piezometer", "standpipe", "monitoring well", "groundwater"], permitHints: ["ground_disturbance"] },
    ],
  },
  {
    id: "highways",
    label: "Highways & traffic",
    activities: [
      { id: "lane_closure", label: "Lane closure & TM", hazardTokens: ["traffic", "chapter 8", "nrswa", "pedestrian", "live traffic"] },
      { id: "surfacing", label: "Surfacing / tarmac", hazardTokens: ["hot works", "bitumen", "fume", "traffic", "plant"] },
      { id: "kerbing", label: "Kerbing & footways", hazardTokens: ["manual handling", "silica", "traffic", "plant"] },
      { id: "road_marking", label: "White lining & road studs", hazardTokens: ["traffic", "solvent", "night work", "live traffic"] },
    ],
  },
  {
    id: "rail",
    label: "Rail",
    activities: [
      { id: "trackside", label: "Trackside / possession works", hazardTokens: ["rail", "trackside", "ole", "pts", "electrified"] },
      { id: "platform", label: "Platform & station works", hazardTokens: ["rail", "work at height", "public", "night work"] },
      { id: "cable_route", label: "Cable route / signalling", hazardTokens: ["rail", "cable", "excavation", "electrical"] },
    ],
  },
  {
    id: "me",
    label: "M&E",
    activities: [
      { id: "hvac", label: "HVAC / AHU / ductwork", hazardTokens: ["hvac", "work at height", "manual handling", "confined"] },
      { id: "pipework", label: "Process pipework & welding", hazardTokens: ["pipework", "hot work", "pressure", "confined"] },
      { id: "fire_alarm", label: "Fire alarm / emergency lighting", hazardTokens: ["electrical", "work at height", "hot work", "lone working"] },
      { id: "solar_ev", label: "Solar PV / EV chargers", hazardTokens: ["solar", "roof", "electrical", "work at height"] },
    ],
  },
  {
    id: "industrial",
    label: "Industrial & shutdown",
    activities: [
      { id: "shutdown", label: "Factory shutdown", hazardTokens: ["shutdown", "isolation", "loto", "confined", "hot work"] },
      { id: "machine_install", label: "Machinery installation", hazardTokens: ["lifting", "loler", "manual handling", "nip point", "conveyor"] },
      { id: "conveyor", label: "Conveyor install / maintenance", hazardTokens: ["conveyor", "nip point", "entanglement", "loto"] },
      { id: "tank_cleaning", label: "Tank cleaning / confined space", hazardTokens: ["confined", "coshh", "atmosphere", "rescue"] },
    ],
  },
  {
    id: "facade_roof",
    label: "Facade & roofing",
    activities: [
      { id: "curtain_wall", label: "Curtain walling / cladding", hazardTokens: ["facade", "cladding", "work at height", "falling object"] },
      { id: "flat_roof", label: "Flat roof / waterproofing", hazardTokens: ["roof", "fragile", "hot works", "fall"] },
      { id: "glazing", label: "Glazing at height", hazardTokens: ["glazing", "manual handling", "work at height", "falling object"] },
    ],
  },
  {
    id: "interiors",
    label: "Interiors & fit-out",
    activities: [
      { id: "drylining", label: "Drylining & partitions", hazardTokens: ["drylining", "dust", "manual handling", "work at height"] },
      { id: "flooring", label: "Flooring (vinyl, carpet, tiles)", hazardTokens: ["flooring", "solvent", "manual handling", "slips"] },
      { id: "kitchens", label: "Kitchen / washroom installation", hazardTokens: ["fit-out", "manual handling", "silica", "occupied"] },
    ],
  },
  {
    id: "plant",
    label: "Plant operation",
    activities: [
      { id: "excavator", label: "Excavator / 360 operation", hazardTokens: ["excavator", "plant", "reversing", "banksman", "services"] },
      { id: "telehandler", label: "Telehandler / FLT", hazardTokens: ["telehandler", "forklift", "lifting", "pedestrian"] },
      { id: "dumper", label: "Dumper / roller", hazardTokens: ["dumper", "roller", "traffic", "reversing", "rollover"] },
      { id: "banksman", label: "Banksman / vehicle marshalling", hazardTokens: ["banksman", "reversing", "pedestrian", "exclusion"] },
    ],
  },
  {
    id: "environmental",
    label: "Environmental",
    activities: [
      { id: "asbestos", label: "Asbestos works", hazardTokens: ["asbestos", "respirator", "decontamination"] },
      { id: "contaminated_land", label: "Contaminated land / GI", hazardTokens: ["contaminated", "borehole", "coshh", "manual handling"] },
      { id: "ecology", label: "Ecology / tree works", hazardTokens: ["arboriculture", "chainsaw", "public", "biological"] },
    ],
  },
  {
    id: "energy",
    label: "Energy & renewables",
    activities: [
      { id: "solar_farm", label: "Solar farm / roof PV", hazardTokens: ["solar", "electrical", "work at height", "manual handling"] },
      { id: "wind", label: "Wind turbine works", hazardTokens: ["wind", "work at height", "manual handling", "lone working"] },
      { id: "bess", label: "Battery storage (BESS)", hazardTokens: ["battery", "electrical", "fire", "coshh"] },
      { id: "substation", label: "Substation / HV works", hazardTokens: ["substation", "hv", "arc", "electrical"] },
    ],
  },
];

/** Cross-cutting RAMS activity modules (from CONSTRUCTION.txt ready-modules list). */
export const CORE_RAMS_ACTIVITY_MODULES = [
  "Excavation", "Trial Holes", "Vacuum Excavation", "CAT & Genny", "GPR Survey", "Utility Detection",
  "Confined Space", "Working at Height", "Scaffold", "MEWP", "Crane Lift", "Manual Handling",
  "COSHH", "Noise", "Dust", "Silica", "Hot Works", "Traffic Management", "Plant Operation",
  "Fuel Storage", "Spill Response", "Lone Working", "Night Work", "Public Interface",
  "Overhead Power Lines", "Temporary Works", "Demolition", "Asbestos", "LOTO", "Permit to Work",
];

/** @param {string} sectorId */
export function getCatalogSector(sectorId) {
  return CONSTRUCTION_ACTIVITY_CATALOG.find((s) => s.id === sectorId) || null;
}

/** @param {string} sectorId @param {string} activityId */
export function getCatalogActivity(sectorId, activityId) {
  const sector = getCatalogSector(sectorId);
  return sector?.activities.find((a) => a.id === activityId) || null;
}

/** Flat list for search autocomplete. */
export function listAllCatalogActivities() {
  return CONSTRUCTION_ACTIVITY_CATALOG.flatMap((sector) =>
    sector.activities.map((a) => ({ ...a, sectorId: sector.id, sectorLabel: sector.label }))
  );
}
