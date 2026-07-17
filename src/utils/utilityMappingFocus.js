/**
 * Utility Mapping product focus — survey-related deliverables for this tenant.
 * Includes PAS128, topo, GPR, CCTV, UAV, laser, clearance; excludes asbestos / food-hygiene types.
 */
import { SURVEY_TYPES } from "../modules/surveyReport/surveyReportConstants";
import { isUtilityMappingOrg } from "./utilityMappingOrg";

/** Survey report types Utility Mapping / surveying crews deliver. */
export const UM_FOCUS_SURVEY_TYPE_KEYS = [
  "utility_mapping_survey",
  "topo_plus_utility_survey",
  "topographical_survey",
  "gpr_survey",
  "eml_cat_survey",
  "service_clearance_survey",
  "gnss_control",
  "setting_out",
  "cctv_drainage_survey",
  "drainage_connectivity_survey",
  "uav_aerial",
  "laser_scanning",
  "general_site_survey",
  "site_investigation_campaign",
];

const UM_FOCUS_SURVEY_SET = new Set(UM_FOCUS_SURVEY_TYPE_KEYS);

/** Global (non-um_*) playbooks still useful for this tenant. */
export const UM_FOCUS_GLOBAL_PLAYBOOK_IDS = new Set([
  "utility_mapping",
  "topo_plus_utility",
  "general",
  "drainage_connectivity",
  "service_clearance",
  "topographical",
]);

/**
 * @param {Array<{ key: string, label: string }>} [types]
 * @param {string} [orgId]
 */
export function listSurveyTypesForOrg(types = SURVEY_TYPES, orgId) {
  const list = Array.isArray(types) ? types : SURVEY_TYPES;
  if (!isUtilityMappingOrg(orgId)) return list;
  const focused = list.filter((t) => UM_FOCUS_SURVEY_SET.has(t.key));
  const byKey = Object.fromEntries(focused.map((t) => [t.key, t]));
  const ordered = UM_FOCUS_SURVEY_TYPE_KEYS.map((k) => byKey[k]).filter(Boolean);
  // Append any allowed keys not in the preferred order list
  for (const t of focused) {
    if (!ordered.some((o) => o.key === t.key)) ordered.push(t);
  }
  return ordered;
}

/** @param {string} surveyType @param {string} [orgId] */
export function isUtilityMappingFocusedSurveyType(surveyType, orgId) {
  if (!isUtilityMappingOrg(orgId)) return true;
  return UM_FOCUS_SURVEY_SET.has(String(surveyType || "").trim());
}

/**
 * Keep UM exclusive playbooks + surveying-related globals.
 * @param {object[]} playbooks
 * @param {string} [orgId]
 */
export function filterPlaybooksForUtilityMappingFocus(playbooks, orgId) {
  const list = Array.isArray(playbooks) ? playbooks : [];
  if (!isUtilityMappingOrg(orgId)) return list;
  return list.filter((p) => {
    const id = String(p?.id || "");
    if (id.startsWith("um_")) return true;
    if (UM_FOCUS_GLOBAL_PLAYBOOK_IDS.has(id)) return true;
    if (p?.surveyType && !UM_FOCUS_SURVEY_SET.has(p.surveyType)) return false;
    if (p?.surveyType) return UM_FOCUS_SURVEY_SET.has(p.surveyType);
    return false;
  });
}
