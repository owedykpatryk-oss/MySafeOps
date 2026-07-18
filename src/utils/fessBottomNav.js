/**
 * FESS Group bottom bar — Sites / RAMS / Permits / People / Photos / More.
 * Food-factory M&E ops first; surveying destinations stay off the primary bar.
 */
import { getModuleLabelForMarket } from "./marketLabels";
import { getOrgMarketId } from "./orgMarket";
import { isFessOrg } from "./fessOrg";

/** Primary bottom destinations for FESS (excludes More). */
export const FESS_BOTTOM_NAV_IDS = [
  "fess-sites",
  "rams",
  "permits",
  "people",
  "geo-photos",
];

/**
 * @param {string} [orgId]
 * @param {Record<string, unknown>} [settings]
 */
export function isFessBottomNavActive(orgId, settings) {
  try {
    return isFessOrg(orgId, settings);
  } catch {
    return false;
  }
}

/**
 * @param {string} [marketId]
 * @returns {{ id: string, label: string }[]}
 */
export function buildFessBottomNavTabDefs(marketId = getOrgMarketId()) {
  // Short bar labels first — full module titles stay in More / app bar.
  const labels = {
    "fess-sites": "Sites",
    rams: "RAMS",
    permits: "Permits",
    people: "People",
    "geo-photos": "Photos",
    more: "More",
  };
  return [...FESS_BOTTOM_NAV_IDS, "more"].map((id) => ({
    id,
    label: labels[id] || getModuleLabelForMarket(id, marketId) || id,
  }));
}

/** Default workspace landing for FESS tenants. */
export function getFessDefaultWorkspaceView() {
  return "fess-sites";
}
