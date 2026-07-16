/**
 * Utility Mapping product focus — only PAS128 / topo / GPR / EML / clearance.
 * Hides CCTV, UAV, laser, asbestos, GI campaign types from this tenant.
 */
import { SURVEY_TYPES } from "../modules/surveyReport/surveyReportConstants";
import { isUtilityMappingOrg } from "./utilityMappingOrg";

/** Survey report types Utility Mapping actually deliver. */
export const UM_FOCUS_SURVEY_TYPE_KEYS = [
  "utility_mapping_survey",
  "topo_plus_utility_survey",
  "topographical_survey",
  "gpr_survey",
  "eml_cat_survey",
  "service_clearance_survey",
  "gnss_control",
];

const UM_FOCUS_SURVEY_SET = new Set(UM_FOCUS_SURVEY_TYPE_KEYS);

/** Global (non-um_*) playbooks still useful for this tenant. */
export const UM_FOCUS_GLOBAL_PLAYBOOK_IDS = new Set([
  "utility_mapping",
  "topo_plus_utility",
  "general",
]);

/**
 * @param {Array<{ key: string, label: string }>} [types]
 * @param {string} [orgId]
 */
export function listSurveyTypesForOrg(types = SURVEY_TYPES, orgId) {
  const list = Array.isArray(types) ? types : SURVEY_TYPES;
  if (!isUtilityMappingOrg(orgId)) return list;
  const focused = list.filter((t) => UM_FOCUS_SURVEY_SET.has(t.key));
  // Preserve UM order, then any unexpected allowed keys.
  const byKey = Object.fromEntries(focused.map((t) => [t.key, t]));
  return UM_FOCUS_SURVEY_TYPE_KEYS.map((k) => byKey[k]).filter(Boolean);
}

/** @param {string} surveyType @param {string} [orgId] */
export function isUtilityMappingFocusedSurveyType(surveyType, orgId) {
  if (!isUtilityMappingOrg(orgId)) return true;
  return UM_FOCUS_SURVEY_SET.has(String(surveyType || "").trim());
}

/**
 * Keep UM exclusive playbooks + a short list of utility/topo globals.
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
    // Drop generic surveying playbooks this tenant will not use (CCTV, UAV, GI, etc.)
    if (p?.surveyType && !UM_FOCUS_SURVEY_SET.has(p.surveyType)) return false;
    if (p?.surveyType) return UM_FOCUS_SURVEY_SET.has(p.surveyType);
    return false;
  });
}
