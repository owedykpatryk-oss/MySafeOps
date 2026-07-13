/**
 * Market-aware site postcode / address lookup (UK / AU / PL).
 */
import { getOrgMarketId } from "./orgMarket";
import { lookupUkPostcode, resolveUkPostcodeInput } from "./postcodeLookup";
import { lookupAuPostcode, resolveAuPostcodeInput } from "./auPostcodeLookup";
import { lookupPlPostcode, resolvePlPostcodeInput } from "./plPostcodeLookup";
import { getPostcodeExample, getPostcodeHint, getGeoLookupSuccessMsg } from "./marketLabels";

/** @param {string} postcode @param {...string} extraText */
export function resolveSitePostcodeInput(postcode, ...extraText) {
  const market =
    typeof window === "undefined" ? "uk" : getOrgMarketId();
  return resolveSitePostcodeInputForMarket(postcode, market, ...extraText);
}

/** @param {string} postcode @param {import("../config/markets").MarketId} marketId @param {...string} extraText */
export function resolveSitePostcodeInputForMarket(postcode, marketId, ...extraText) {
  if (marketId === "au") return resolveAuPostcodeInput(postcode, ...extraText);
  if (marketId === "pl") return resolvePlPostcodeInput(postcode, ...extraText);
  return resolveUkPostcodeInput(postcode, ...extraText);
}

/** @param {string} postcode @param {import("../config/markets").MarketId} [marketId] */
export async function lookupSitePostcode(postcode, marketId = getOrgMarketId()) {
  if (marketId === "au") return lookupAuPostcode(postcode);
  if (marketId === "pl") return lookupPlPostcode(postcode);
  return lookupUkPostcode(postcode);
}

export { getPostcodeHint as sitePostcodeHint, getPostcodeExample as sitePostcodeExample, getGeoLookupSuccessMsg as geoLookupSuccessMsg };
