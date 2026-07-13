/**
 * Built-in construction quick packs — seeded once per org from hazard library IDs.
 */

/** @param {object} h */
export function hazardToPackTemplate(h) {
  if (!h?.id) return null;
  return {
    templateId: String(h.id),
    category: h.category || "General",
    activity: h.activity || "",
    hazard: h.hazard || "",
    initialRisk: h.initialRisk || { L: 4, S: 4, RF: 16 },
    revisedRisk: h.revisedRisk || { L: 2, S: 4, RF: 8 },
    controlMeasures: (h.controlMeasures || []).filter(Boolean),
    ppeRequired: (h.ppeRequired || []).filter(Boolean),
    regs: (h.regs || []).filter(Boolean),
    permitTypes: (h.permitTypes || []).filter(Boolean),
    requiredCerts: (h.requiredCerts || []).filter(Boolean),
  };
}

/** @typedef {{ id: string, name: string, sector: string, hazardIds: string[], pinned?: boolean, description?: string }} PackDef */

/** @type {PackDef[]} */
export const BUILTIN_CONSTRUCTION_PACK_DEFS = [
  {
    id: "builtin_construction_groundworks",
    name: "Construction & groundworks",
    sector: "construction",
    pinned: true,
    description: "Excavation, services, scaffold, demolition, silica — core civils pack.",
    hazardIds: [
      "gnd_001", "gnd_002", "gnd_003", "gnd_004",
      "scaf_001", "scaf_002",
      "dem_001", "twx_001", "twx_002",
      "con_001", "con_002",
      "cst_site_002", "cst_site_003",
      "plant_001", "plant_003", "plant_004",
    ],
  },
  {
    id: "builtin_utilities_water_sewer",
    name: "Utilities — water & sewer",
    sector: "utilities",
    pinned: true,
    description: "Water mains, sewer jetting, CCTV, chambers, excavation near services.",
    hazardIds: ["util_w001", "util_w002", "gnd_002", "gnd_001", "plant_003", "cs_001"],
  },
  {
    id: "builtin_utilities_gas_electric",
    name: "Utilities — gas & electric",
    sector: "utilities",
    pinned: true,
    description: "Gas mains, HV/LV, OHPL proximity, isolation and jointing.",
    hazardIds: ["util_g001", "util_e001", "util_e002", "elec_002", "elec_001", "gas_001"],
  },
  {
    id: "builtin_utilities_telecom",
    name: "Utilities — telecoms & fibre",
    sector: "utilities",
    pinned: false,
    description: "Fibre blowing, chambers, ducts, telecoms civils.",
    hazardIds: ["util_t001", "tel_001", "tel_002", "gnd_002"],
  },
  {
    id: "builtin_highways_traffic",
    name: "Highways & traffic management",
    sector: "highways",
    pinned: true,
    description: "Chapter 8 TM, surfacing, NRSWA streetworks.",
    hazardIds: ["hwy_001", "hwy_002", "tmp_001", "tmp_002", "tmp_003", "tm_001"],
  },
  {
    id: "builtin_rail_trackside",
    name: "Rail trackside & OLE",
    sector: "rail",
    pinned: false,
    description: "Trackside works, OLE awareness, possession interfaces.",
    hazardIds: ["rail_001", "rail_002", "rail_003", "scaf_001"],
  },
  {
    id: "builtin_me_hvac",
    name: "M&E — HVAC, pipework & electrical",
    sector: "me",
    pinned: false,
    description: "Mechanical, HVAC, pipework, electrical maintenance.",
    hazardIds: ["mech_001", "mech_002", "gas_001", "gas_002", "elec_002", "elec_003"],
  },
  {
    id: "builtin_facade_roofing",
    name: "Facade, cladding & roofing",
    sector: "construction",
    pinned: false,
    description: "Work at height, fragile roofs, cladding, glazing.",
    hazardIds: ["fcd_001", "fcd_002", "roof_001", "roof_002", "roof_003", "scaf_002", "wah_001"],
  },
  {
    id: "builtin_interiors_fitout",
    name: "Interiors & fit-out",
    sector: "construction",
    pinned: false,
    description: "Drylining, ceilings, kitchens, flooring, occupied buildings.",
    hazardIds: ["int_001", "int_002", "dec_001", "dec_002", "cst_site_002"],
  },
  {
    id: "builtin_industrial_shutdown",
    name: "Industrial shutdown & lifting",
    sector: "industrial",
    pinned: true,
    description: "Factory shutdown, LOLER lifts, conveyors, LOTO.",
    hazardIds: ["ind_001", "ind_002", "lift_001", "mach_001", "wh_003", "weld_001"],
  },
  {
    id: "builtin_energy_renewables",
    name: "Energy & renewables",
    sector: "energy",
    pinned: false,
    description: "Solar PV, BESS, substations, EV infrastructure.",
    hazardIds: ["enr_001", "enr_002", "solar_001", "solar_002", "solar_003", "bes_001"],
  },
  {
    id: "builtin_environmental",
    name: "Environmental & ecology",
    sector: "environmental",
    pinned: false,
    description: "Arboriculture, contaminated land, asbestos interfaces.",
    hazardIds: ["env_001", "env_002", "asb_001", "clr_001", "clr_002"],
  },
  {
    id: "builtin_survey_core",
    name: "Surveying — core field hazards",
    sector: "surveying",
    pinned: true,
    description: "GPR, topo, traffic, chambers, lone working — pairs with PAS128 packs.",
    hazardIds: ["gnd_002", "cst_site_003", "plant_003", "util_w002", "gen_003"],
  },
  {
    id: "builtin_plant_operation",
    name: "Plant operation & banksman",
    sector: "construction",
    pinned: true,
    description: "360, telehandler, dumper/roller, banksman, fuel — core civils plant pack.",
    hazardIds: ["plant_001", "plant_002", "plant_003", "plant_004", "plant_005", "ind_002", "gnd_002"],
  },
  {
    id: "builtin_confined_space",
    name: "Confined space & tank entry",
    sector: "construction",
    pinned: true,
    description: "Chambers, tanks, sewers — permit, gas test, rescue and top-man controls.",
    hazardIds: ["cs_001", "cst_conf_002", "util_w002", "wh_003", "fess_003"],
  },
  {
    id: "builtin_concrete_piling",
    name: "Concrete, piling & formwork",
    sector: "construction",
    pinned: true,
    description: "Piling, pours, formwork, temp works and post-tensioning.",
    hazardIds: ["gnd_003", "cst_pil_002", "con_001", "con_002", "con_003", "con_004", "twx_001", "twx_002"],
  },
  {
    id: "builtin_night_public_works",
    name: "Night works & public interface",
    sector: "construction",
    pinned: false,
    description: "Night shifts, lighting, fatigue, occupied premises and pedestrian management.",
    hazardIds: ["tm_004", "cst_night_001", "cst_site_003", "cst_site_002", "tmp_001"],
  },
  {
    id: "builtin_healthcare_fm",
    name: "Healthcare & cleanroom FM",
    sector: "maintenance",
    pinned: false,
    description: "HTM/IPC controls for works in hospitals, labs and cleanrooms.",
    hazardIds: ["hc_001", "hc_002", "hc_003", "hc_004", "cst_site_002", "clr_001"],
  },
  {
    id: "builtin_insulation_fire_stopping",
    name: "Insulation & fire stopping",
    sector: "construction",
    pinned: false,
    description: "Spray foam, passive fire seals and sprinkler interfaces.",
    hazardIds: ["fire_001", "fire_002", "fire_003", "cst_insul_001", "dec_001"],
  },
  {
    id: "builtin_timber_frame",
    name: "Timber frame & carpentry",
    sector: "construction",
    pinned: false,
    description: "Panel erection, nail guns, silica cuts and scaffold/WAH interfaces.",
    hazardIds: ["cst_timber_001", "cst_timber_002", "scaf_001", "wah_001", "cst_site_002"],
  },
  {
    id: "builtin_wind_energy",
    name: "Wind energy & turbine service",
    sector: "energy",
    pinned: false,
    description: "Tower climbing, nacelle service, GWO rescue and weather limits.",
    hazardIds: ["enr_001", "cst_wind_001", "wah_002", "lift_001"],
  },
];

/** Geospatial survey — utility mapping, aerial, laser scan, marine, tunnel, mining. */
export const BUILTIN_GEOSPATIAL_PACK_DEFS = [
  {
    id: "builtin_geospatial_utility_as5488",
    name: "Geospatial — AS5488 / PAS128 utility intelligence",
    sector: "surveying",
    pinned: true,
    description: "GPR, EM, NDD, QL assignment, pavement scan and chambers.",
    hazardIds: ["geo_util_as5488_001", "geo_pave_001", "gnd_002", "util_w002", "cs_001", "plant_003", "cst_site_003"],
  },
  {
    id: "builtin_photomapping_aerial",
    name: "Geospatial — Aerial imagery & LiDAR",
    sector: "surveying",
    pinned: true,
    description: "Helicopter, fixed-wing and UAV corridor mapping.",
    hazardIds: ["geo_aerial_001", "geo_aerial_002", "cst_site_003", "tm_004", "gen_003"],
  },
  {
    id: "builtin_laser_scan_digital_twin",
    name: "Geospatial — Laser scan & digital twin",
    sector: "surveying",
    pinned: true,
    description: "TLS, dimensional control, deformation monitoring and BIM capture.",
    hazardIds: ["geo_scan_001", "geo_scan_002", "geo_dim_001", "geo_cad_001", "wh_001", "plant_003"],
  },
  {
    id: "builtin_hydrographic_marine",
    name: "Geospatial — Hydrographic & marine survey",
    sector: "surveying",
    pinned: false,
    description: "Bathymetry, vessel ops and tidal interfaces.",
    hazardIds: ["geo_hydro_001", "mar_001", "cst_mar_001", "env_001"],
  },
  {
    id: "builtin_tunnel_mobile_mapping",
    name: "Geospatial — Tunnel & mobile mapping",
    sector: "surveying",
    pinned: false,
    description: "Tunnel scan, mobile LiDAR, rail corridor and confined corridor capture.",
    hazardIds: ["geo_tunnel_001", "geo_scan_002", "cs_001", "rail_001", "wh_003"],
  },
  {
    id: "builtin_mining_resources_survey",
    name: "Geospatial — Mining & resources survey",
    sector: "surveying",
    pinned: false,
    description: "Open-pit, dam monitoring and remote resources sector campaigns.",
    hazardIds: ["geo_mine_001", "geo_dam_001", "gnd_002", "gen_003", "plant_003"],
  },
];

/** Site investigation & geotechnics — DCP, probing, boreholes, coring, piezometers. */
export const BUILTIN_SITE_INVESTIGATION_PACK_DEFS = [
  {
    id: "builtin_site_investigation_geotechnics",
    name: "Site investigation — GI & geotechnics",
    sector: "surveying",
    pinned: true,
    description: "Window sampling, trial pits, DCP, boreholes, coring, augers, piezometers and ground gas.",
    hazardIds: [
      "si_001",
      "si_002",
      "si_003",
      "si_004",
      "si_005",
      "si_006",
      "si_007",
      "si_008",
      "si_009",
      "si_011",
      "si_012",
      "env_002",
      "gnd_001",
      "gnd_002",
      "cs_001",
    ],
  },
  {
    id: "builtin_site_investigation_drilling",
    name: "Site investigation — Drilling & coring",
    sector: "surveying",
    pinned: false,
    description: "Cable percussive, rotary, U100 undisturbed sampling and monitoring wells.",
    hazardIds: ["si_005", "si_006", "si_008", "si_009", "si_011", "gnd_002", "env_002", "plant_003"],
  },
  {
    id: "builtin_site_investigation_in_situ",
    name: "Site investigation — In-situ testing",
    sector: "surveying",
    pinned: false,
    description: "DCP/dynamic probing, CPT, hand auger and shallow sampling.",
    hazardIds: ["si_003", "si_004", "si_007", "si_012", "gnd_002", "cst_site_003"],
  },
];

/** Food & pharma hazard rows — factory M&E, lifting, production line extensions */
export const BUILTIN_FOOD_PHARMA_PACK_DEFS = [
  {
    id: "builtin_food_factory_me",
    name: "Food & pharma — Factory M&E",
    sector: "food_pharma",
    pinned: true,
    description: "Allergen zones, conveyors, SCADA, high-care and CIP interfaces.",
    hazardIds: Array.from({ length: 27 }, (_, i) => `fess_${String(i + 1).padStart(3, "0")}`),
  },
  {
    id: "builtin_food_production_line",
    name: "Food & pharma — Production line",
    sector: "food_pharma",
    pinned: true,
    description: "Open product lines, changeovers, foreign body and hygiene barriers.",
    hazardIds: Array.from({ length: 14 }, (_, i) => `foodl_${String(i + 1).padStart(3, "0")}`),
  },
  {
    id: "builtin_food_pet_food",
    name: "Food & pharma — Pet food production",
    sector: "food_pharma",
    pinned: false,
    description: "Pet food line hazards — dust, allergens, mechanical interfaces.",
    hazardIds: Array.from({ length: 11 }, (_, i) => `petf_${String(i + 1).padStart(3, "0")}`),
  },
  {
    id: "builtin_food_lifting",
    name: "Food & pharma — Lifting operations",
    sector: "industrial",
    pinned: true,
    description: "LOLER lifts, rigging and suspended loads in factory and civils contexts.",
    hazardIds: Array.from({ length: 8 }, (_, i) => `xlift_${String(i + 1).padStart(3, "0")}`),
  },
  {
    id: "builtin_food_survey_extension",
    name: "Food & pharma — Survey extension",
    sector: "surveying",
    pinned: false,
    description: "Extended survey hazards — traffic, OHPL, chambers on industrial sites.",
    hazardIds: Array.from({ length: 15 }, (_, i) => `xsur_${String(i + 1).padStart(3, "0")}`),
  },
  {
    id: "builtin_food_construction_extension",
    name: "Food & pharma — Construction extension",
    sector: "construction",
    pinned: false,
    description: "Additional civils and groundworks on food factory sites.",
    hazardIds: Array.from({ length: 12 }, (_, i) => `xcon_${String(i + 1).padStart(3, "0")}`),
  },
  {
    id: "builtin_food_scada_conveyor",
    name: "Food & pharma — SCADA, PLC & conveyors",
    sector: "food_pharma",
    pinned: true,
    description: "Automation commissioning, nip points and entanglement.",
    hazardIds: ["fess_023", "fess_024", "fess_025", "petf_007", "ind_002", "mach_001", "wh_003"],
  },
  {
    id: "builtin_food_line_clearance",
    name: "Food & pharma — Line clearance & allergen",
    sector: "food_pharma",
    pinned: true,
    description: "Production line clearance, allergen isolation and restart hold points.",
    hazardIds: ["cst_food_lc_001", "fess_001", "fess_002", "foodl_001", "foodl_002", "foodl_003"],
  },
  {
    id: "builtin_food_cip_hygiene",
    name: "Food & pharma — CIP & hygiene shutdown",
    sector: "food_pharma",
    pinned: false,
    description: "CIP chemicals, hygiene shutdown and vessel entry interfaces.",
    hazardIds: ["cst_food_cip_001", "fess_003", "ind_001", "cs_001"],
  },
];

/** @deprecated Use BUILTIN_FOOD_PHARMA_PACK_DEFS */
export const BUILTIN_FESS_PACK_DEFS = BUILTIN_FOOD_PHARMA_PACK_DEFS;

const FOOD_PACK_LEGACY_IDS = {
  builtin_fess_food_factory_me: "builtin_food_factory_me",
  builtin_fess_food_production_line: "builtin_food_production_line",
  builtin_fess_pet_food: "builtin_food_pet_food",
  builtin_fess_lifting_excel: "builtin_food_lifting",
  builtin_fess_survey_excel: "builtin_food_survey_extension",
  builtin_fess_construction_excel: "builtin_food_construction_extension",
  builtin_fess_scada_conveyor: "builtin_food_scada_conveyor",
  builtin_fess_line_clearance: "builtin_food_line_clearance",
  builtin_fess_cip_hygiene: "builtin_food_cip_hygiene",
};

const AU_EXCLUDED_BUILTIN_PACK_IDS = new Set([
  "builtin_survey_core",
  "builtin_rail_trackside",
  "builtin_highways_traffic",
]);

/** @type {PackDef[]} */
export const BUILTIN_AU_CONSTRUCTION_PACK_DEFS = [
  {
    id: "builtin_au_hrcw_core",
    name: "AU — HRCW core (height, excavation, CS)",
    sector: "construction",
    pinned: true,
    description: "High-risk construction work — WAH, excavation, confined space, plant interfaces.",
    hazardIds: ["wah_001", "gnd_001", "gnd_002", "cs_001", "scaf_001", "scaf_002", "plant_003", "cst_site_002"],
  },
  {
    id: "builtin_au_electrical_energised",
    name: "AU — Electrical & energised work",
    sector: "construction",
    pinned: true,
    description: "HV/LV isolation, OHPL, energised work — align SWMS with AS/NZS 3012.",
    hazardIds: ["elec_001", "elec_002", "elec_003", "util_e001", "util_e002", "gas_001"],
  },
  {
    id: "builtin_au_demolition_asbestos",
    name: "AU — Demolition & hazardous materials",
    sector: "construction",
    pinned: false,
    description: "Demolition, asbestos interfaces, silica — DBYD and isolation before disturbance.",
    hazardIds: ["dem_001", "asb_001", "clr_001", "con_001", "gnd_002", "env_002"],
  },
  {
    id: "builtin_au_civil_groundworks",
    name: "AU — Civil & groundworks",
    sector: "construction",
    pinned: true,
    description: "Excavation, services, concrete, temp works — core civils SWMS pack.",
    hazardIds: ["gnd_001", "gnd_003", "gnd_004", "con_001", "con_002", "twx_001", "plant_001", "plant_004"],
  },
];

const BUILTIN_PL_CONSTRUCTION_PACK_DEFS = [
  {
    id: "builtin_pl_bhp_core",
    name: "PL — IOR core (wysokość, wykop, CS)",
    sector: "construction",
    pinned: true,
    description: "Roboty szczególnie niebezpieczne — wysokość, wykop, przestrzeń zamknięta, maszyny.",
    hazardIds: ["wah_001", "gnd_001", "gnd_002", "cs_001", "scaf_001", "scaf_002", "plant_003", "cst_site_002"],
  },
  {
    id: "builtin_pl_electrical",
    name: "PL — Prace elektryczne i SEP",
    sector: "construction",
    pinned: true,
    description: "Izolacja, prace pod napięciem — zgodnie z wymaganiami SEP na budowie.",
    hazardIds: ["elec_001", "elec_002", "elec_003", "util_e001", "util_e002", "gas_001"],
  },
  {
    id: "builtin_pl_civil",
    name: "PL — Roboty ziemne i drogowe",
    sector: "construction",
    pinned: true,
    description: "Wykopy, uzbrojenie, beton, roboty tymczasowe — pakiet IOR dla budowy.",
    hazardIds: ["gnd_001", "gnd_003", "gnd_004", "con_001", "con_002", "twx_001", "plant_001", "plant_004"],
  },
];

function regionalConstructionPackDefs(marketId) {
  const excluded = [...AU_EXCLUDED_BUILTIN_PACK_IDS];
  const base = BUILTIN_CONSTRUCTION_PACK_DEFS.filter((d) => !excluded.has(d.id));
  if (marketId === "au") {
    return [...base, ...BUILTIN_AU_CONSTRUCTION_PACK_DEFS];
  }
  if (marketId === "pl") {
    return [...base, ...BUILTIN_PL_CONSTRUCTION_PACK_DEFS];
  }
  return BUILTIN_CONSTRUCTION_PACK_DEFS;
}

/** @param {import("../config/markets").MarketId} [marketId] */
export function getBuiltInConstructionPackDefs(marketId = "uk") {
  return regionalConstructionPackDefs(marketId);
}

const ALL_BUILTIN_PACK_DEFS = [
  ...BUILTIN_CONSTRUCTION_PACK_DEFS,
  ...BUILTIN_GEOSPATIAL_PACK_DEFS,
  ...BUILTIN_SITE_INVESTIGATION_PACK_DEFS,
  ...BUILTIN_FOOD_PHARMA_PACK_DEFS,
];

/**
 * @param {object[]} allHazards
 * @param {PackDef} def
 */
export function buildPackFromDef(allHazards, def) {
  const byId = Object.fromEntries((allHazards || []).map((h) => [h.id, h]));
  const templates = (def.hazardIds || [])
    .map((id) => byId[id])
    .filter(Boolean)
    .map(hazardToPackTemplate)
    .filter(Boolean);
  if (templates.length === 0) return null;
  const now = new Date().toISOString();
  return {
    id: def.id,
    name: def.name,
    sector: def.sector,
    description: def.description || "",
    builtIn: true,
    isPinned: !!def.pinned,
    status: "current",
    version: 1,
    templates,
    keywords: def.hazardIds,
    createdAt: now,
    updatedAt: now,
    appliedCount: 0,
  };
}

/**
 * Merge built-in packs into org storage when not yet present.
 * @param {object[]} existingPacks
 * @param {object[]} allHazards
 * @param {import("../config/markets").MarketId} [marketId]
 * @returns {object[]}
 */
export function ensureBuiltInConstructionPacks(existingPacks, allHazards, marketId) {
  const list = Array.isArray(existingPacks) ? [...existingPacks] : [];
  for (const pack of list) {
    const nextId = FOOD_PACK_LEGACY_IDS[pack.id];
    if (nextId) pack.id = nextId;
  }
  const existingIds = new Set(list.map((p) => p.id));
  let defs = ALL_BUILTIN_PACK_DEFS;
  if (marketId === "au" || marketId === "pl") {
    const seen = new Set();
    const regional = marketId === "au" ? BUILTIN_AU_CONSTRUCTION_PACK_DEFS : BUILTIN_PL_CONSTRUCTION_PACK_DEFS;
    defs = [
      ...ALL_BUILTIN_PACK_DEFS.filter((d) => !AU_EXCLUDED_BUILTIN_PACK_IDS.has(d.id)),
      ...regional,
    ].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }
  const missing = defs.filter((d) => !existingIds.has(d.id));
  if (missing.length === 0) return list;
  const built = missing
    .map((def) => buildPackFromDef(allHazards, def))
    .filter(Boolean);
  return [...built, ...list];
}
