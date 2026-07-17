/**
 * Surveying-company bottom bar — Projects / RAMS / Survey / GPR / Geo-photos / More.
 * Used for Utility Mapping and geospatial industry packs only.
 */
import { getModuleLabelForMarket } from "./marketLabels";
import { getOrgMarketId } from "./orgMarket";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { isGeospatialPackActive } from "./geospatialPackGate";

/** Primary bottom destinations for surveying tenants (excludes More). */
export const SURVEYING_BOTTOM_NAV_IDS = [
  "projects",
  "rams",
  "survey-report",
  "gpr-report",
  "geo-photos",
];

/**
 * @param {string} [orgId]
 * @param {Record<string, unknown>} [settings]
 */
export function isSurveyingBottomNavActive(orgId, settings) {
  if (isUtilityMappingOrg(orgId, settings)) return true;
  try {
    return isGeospatialPackActive();
  } catch {
    return false;
  }
}

/**
 * @param {string} [marketId]
 * @returns {{ id: string, label: string }[]}
 */
export function buildSurveyingBottomNavTabDefs(marketId = getOrgMarketId()) {
  const labels = {
    projects: "Projects",
    rams: "RAMS",
    "survey-report": "Survey",
    "gpr-report": "GPR",
    "geo-photos": "Photos",
    more: "More",
  };
  return [...SURVEYING_BOTTOM_NAV_IDS, "more"].map((id) => ({
    id,
    label: getModuleLabelForMarket(id, marketId) || labels[id] || id,
  }));
}
