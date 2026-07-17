/**
 * Lightweight geospatial pack gate — no hazard-library imports (safe for app shell / bottom nav).
 */
import { loadOrgSettingsRaw } from "./orgSettingsStorage";

export const GEOSPATIAL_PACK_IDS = new Set([
  "surveyingGeodesy",
  "contractorPlusSurveying",
  "utilityMapping",
]);

/**
 * True when the org industry pack is surveying / geospatial / Utility Mapping.
 * @param {Record<string, unknown>} [settings]
 */
export function isGeospatialPackActive(settings) {
  const id = (settings ?? loadOrgSettingsRaw()).industryPackId;
  return GEOSPATIAL_PACK_IDS.has(id);
}
