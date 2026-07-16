/**
 * Utility Mapping org-exclusive RAMS quick packs — PAS128 field survey baselines.
 * Only seeded when isUtilityMappingOrg(); stripped for every other tenant.
 */
export const UM_PAS128_BASELINE_PACK_DEF = {
  id: "orgexclusive_um_pas128_baseline",
  name: "UM — PAS128 field survey baseline",
  sector: "surveying",
  pinned: true,
  orgExclusive: true,
  description:
    "Core Utility Mapping site risks — traffic, chambers, buried services, plant interface, lone working and GPR/EML field controls.",
  hazardIds: [
    "geo_util_as5488_001",
    "geo_pave_001",
    "gnd_002",
    "util_w002",
    "cs_001",
    "plant_003",
    "cst_site_003",
    "gen_003",
    "tm_004",
  ],
};

export const UM_GPR_DAY_PACK_DEF = {
  id: "orgexclusive_um_gpr_day",
  name: "UM — GPR survey day",
  sector: "surveying",
  pinned: true,
  orgExclusive: true,
  description: "Vehicle/array GPR, pavement scan, banksman and Chapter 8 interface for corridor GPR days.",
  hazardIds: ["geo_util_as5488_001", "geo_pave_001", "plant_003", "cst_site_003", "tm_004", "gnd_002"],
};

export const UM_EML_CAT_PACK_DEF = {
  id: "orgexclusive_um_eml_cat",
  name: "UM — EML / CAT & Genny",
  sector: "surveying",
  pinned: false,
  orgExclusive: true,
  description: "Electromagnetic location, induction, sonde/flexi-trace and mark-up with UV paint.",
  hazardIds: ["geo_util_as5488_001", "util_w002", "gnd_002", "gen_003", "cst_site_003"],
};

export const UM_CHAMBER_MH_PACK_DEF = {
  id: "orgexclusive_um_chamber_mh",
  name: "UM — MH / IC lifting",
  sector: "surveying",
  pinned: false,
  orgExclusive: true,
  description: "Manhole and inspection chamber lifting, gas monitoring and confined-space awareness.",
  hazardIds: ["cs_001", "util_w002", "wh_003", "gen_003", "gnd_002"],
};

export const UM_SERVICE_CLEARANCE_PACK_DEF = {
  id: "orgexclusive_um_service_clearance",
  name: "UM — Service clearance for GI",
  sector: "surveying",
  pinned: false,
  orgExclusive: true,
  description: "Clearance mark-up ahead of trial pits / boreholes — records review and dig interface.",
  hazardIds: ["geo_util_as5488_001", "util_w002", "gnd_002", "gnd_003", "cst_site_003"],
};

/** @type {typeof UM_PAS128_BASELINE_PACK_DEF[]} */
export const UM_ORG_EXCLUSIVE_PACK_DEFS = [
  UM_PAS128_BASELINE_PACK_DEF,
  UM_GPR_DAY_PACK_DEF,
  UM_EML_CAT_PACK_DEF,
  UM_CHAMBER_MH_PACK_DEF,
  UM_SERVICE_CLEARANCE_PACK_DEF,
];
