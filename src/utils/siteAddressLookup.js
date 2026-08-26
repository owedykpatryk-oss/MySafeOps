/**
 * Market-aware site postcode / address lookup (UK / AU / PL / DE / AT).
 */
import { getOrgMarketId } from "./orgMarket";
import { lookupUkPostcode, resolveUkPostcodeInput } from "./postcodeLookup";
import { lookupAuPostcode, resolveAuPostcodeInput } from "./auPostcodeLookup";
import { lookupPlPostcode, resolvePlPostcodeInput } from "./plPostcodeLookup";
import { lookupDePostcode, resolveDePostcodeInput } from "./dePostcodeLookup";
import { lookupAtPostcode, resolveAtPostcodeInput } from "./atPostcodeLookup";
import { lookupChPostcode, resolveChPostcodeInput } from "./chPostcodeLookup";
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
  if (marketId === "de") return resolveDePostcodeInput(postcode, ...extraText);
  if (marketId === "at") return resolveAtPostcodeInput(postcode, ...extraText);
  if (marketId === "ch") return resolveChPostcodeInput(postcode, ...extraText);
  return resolveUkPostcodeInput(postcode, ...extraText);
}

/** @param {string} postcode @param {import("../config/markets").MarketId} [marketId] */
export async function lookupSitePostcode(postcode, marketId = getOrgMarketId()) {
  if (marketId === "au") return lookupAuPostcode(postcode);
  if (marketId === "pl") return lookupPlPostcode(postcode);
  if (marketId === "de") return lookupDePostcode(postcode);
  if (marketId === "at") return lookupAtPostcode(postcode);
  if (marketId === "ch") return lookupChPostcode(postcode);
  return lookupUkPostcode(postcode);
}

export { getPostcodeHint as sitePostcodeHint, getPostcodeExample as sitePostcodeExample, getGeoLookupSuccessMsg as geoLookupSuccessMsg };
