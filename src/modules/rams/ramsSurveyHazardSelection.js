/** Task-specific suggestions. Site context and competent review are still required. */
const FIELD = ["gen_001", "mh_001"];
const UTILITY = ["elec_005", "gnd_002"];
const INTRUSIVE = [...UTILITY, "gnd_001", "si_011"];
export const SURVEY_TASK_HAZARD_IDS = {
  utility_mapping_survey: UTILITY,
  topographical_survey: [],
  topo_plus_utility_survey: UTILITY,
  gpr_survey: ["elec_005"],
  cctv_drainage_survey: ["util_w002"],
  drainage_connectivity_survey: ["util_w002"],
  service_clearance_survey: UTILITY,
  jetting_hpwj: ["util_w002", "gen_003"],
  manhole_entry_inspection: ["util_w002", "cs_001", "clr_002"],
  trial_holes_slit_trenches: [...INTRUSIVE, "si_012"],
  window_sampling_trial_pit: [...INTRUSIVE, "si_001", "si_002", "si_012"],
  borehole_gi_drilling: [...UTILITY, "si_005", "si_006", "si_011", "gen_003"],
  dcp_dynamic_probe: [...UTILITY, "si_003", "si_011"],
  cpt_cone_penetration: [...UTILITY, "si_004", "si_011"],
  cable_percussive_boring: [...UTILITY, "si_005", "si_011", "gen_003"],
  rotary_coring_drilling: [...UTILITY, "si_006", "si_011", "gen_003"],
  hand_auger_sampling: [...UTILITY, "si_007", "si_011"],
  undisturbed_core_u100: [...UTILITY, "si_008", "si_011"],
  piezometer_standpipe: [...UTILITY, "si_009", "si_011"],
  machine_trial_pit_gi: [...INTRUSIVE, "si_002", "si_012"],
  site_investigation_campaign: [...INTRUSIVE, "env_002", "si_001", "si_002", "si_005", "si_006", "si_012"],
  foundation_exposure_verification: [...INTRUSIVE, "si_012"],
  soakaway_infiltration_testing: [...INTRUSIVE, "gnd_004", "si_012"],
  vacuum_excavation_services: [...INTRUSIVE, "gen_003"],
  highway_live_corridor_survey: [...UTILITY, "site_ctx_007", "site_ctx_008", "hwy_001"],
  utility_revalidation_pre_dig: UTILITY,
  drainage_repair_reinstatement_survey: [...INTRUSIVE, "util_w002"],
  rail_public_infrastructure_survey: [...UTILITY, "site_ctx_005", "site_ctx_006", "rail_001", "rail_002", "rail_006"],
  as5488_utility_deliverable: [...UTILITY, "geo_util_as5488_001"],
  hydrographic_bathymetric_survey: ["geo_hydro_001"],
  uav_aerial: ["geo_aerial_001", "geo_aerial_002"],
  laser_scanning: ["geo_scan_001"],
  eml_cat_survey: UTILITY,
  gnss_control: [],
  setting_out: [],
  general_site_survey: [],
  asbestos_survey: ["asb_001"],
  mobile_mapping_slam: ["geo_scan_002"],
  tunnel_condition_scan: ["geo_tunnel_001", "cs_001", "clr_002"],
  dimensional_control_monitoring: ["geo_dim_001"],
  cadastral_boundary_survey: ["geo_cad_001"],
  mining_open_pit_survey: ["geo_mine_001"],
  dam_structural_monitoring: ["geo_dam_001"],
  pavement_3d_gpr_scan: ["geo_pave_001", "site_ctx_007", "site_ctx_008", "hwy_001"],
};

export function selectSurveyHazards(pack, library, limit = 14) {
  if (!pack || !Array.isArray(library)) return [];
  const key = pack.key || pack.surveyType;
  const required = pack.hazardIds || (Object.hasOwn(SURVEY_TASK_HAZARD_IDS, key)
    ? [...FIELD, ...SURVEY_TASK_HAZARD_IDS[key]] : null);
  if (Array.isArray(required)) {
    // Required suggestions must not be silently lost to an arbitrary display limit.
    const byId = new Map(library.map((h) => [h.id, h]));
    return [...new Set(required)].map((id) => byId.get(id)).filter(Boolean);
  }
  // Custom packs retain text search, ranked by token matches instead of library order.
  const tokens = [...new Set((pack.hazardTokens || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  return library.map((h, index) => {
    const words = ` ${h.id} ${h.category} ${h.activity} ${h.hazard} `.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, " ");
    const score = tokens.filter((t) => words.includes(` ${t.replace(/[^\p{L}\p{N}_]+/gu, " ")} `)).length;
    return { h, index, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit).map((r) => r.h);
}
