/** @typedef {import("../config/markets").MarketId} MarketId */

import { getMarketLabelPack } from "../config/marketLabelPacks";
import { AU_PLAN_PRICE_LABELS } from "../config/auPricing";
import { PL_PLAN_PRICE_LABELS } from "../config/plPricing";

/** @param {string} moduleId @param {MarketId} [marketId] */
export function getModuleLabelForMarket(moduleId, marketId = "uk") {
  const pack = getMarketLabelPack(marketId);
  return pack.moduleLabels?.[moduleId] ?? null;
}

/** @param {MarketId} marketId */
export function getRamsShortLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).ramsShort;
}

/** @param {MarketId} marketId */
export function getRamsLongLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).ramsLong;
}

/** @param {MarketId} marketId */
export function getEmergencyServicesLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).emergencyServices;
}

/** @param {MarketId} marketId */
export function getCompetencyCardHint(marketId = "uk") {
  return getMarketLabelPack(marketId).competencyHint;
}

/** @param {MarketId} marketId */
export function getLegislationSeedLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).legislationSeedLabel;
}

/** @param {MarketId} marketId */
export function getLegislationSeedHint(marketId = "uk") {
  return getMarketLabelPack(marketId).legislationSeedHint;
}

/** @param {MarketId} marketId */
export function getCdmStepLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).cdmStepLabel;
}

/** @param {MarketId} marketId */
export function getCdmStepHint(marketId = "uk") {
  return getMarketLabelPack(marketId).cdmStepHint;
}

/** @param {MarketId} marketId */
export function getFirstRamsStepLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).firstRamsStepLabel;
}

/** @param {MarketId} marketId */
export function getFirstRamsStepHint(marketId = "uk") {
  return getMarketLabelPack(marketId).firstRamsStepHint;
}

/** @param {MarketId} marketId */
export function getHazardPacksStepLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).hazardPacksStepLabel;
}

/** @param {MarketId} marketId */
export function getEmergencyHospitalHeading(marketId = "uk") {
  return getMarketLabelPack(marketId).hospitalHeading;
}

/** @param {MarketId} marketId */
export function getEmergencyServicesNumber(marketId = "uk") {
  return getMarketLabelPack(marketId).emergencyNumber;
}

/** @param {MarketId} marketId */
export function getPostcodeHint(marketId = "uk") {
  return getMarketLabelPack(marketId).postcodeHint;
}

/** @param {MarketId} marketId */
export function getPostcodeExample(marketId = "uk") {
  return getMarketLabelPack(marketId).postcodeExample;
}

/** @param {MarketId} marketId */
export function getGeoLookupSuccessMsg(marketId = "uk") {
  return getMarketLabelPack(marketId).geoLookupSuccess;
}

/** @param {MarketId} marketId */
export function getPermitStepLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).permitStepLabel;
}

/** @param {MarketId} marketId */
export function getPermitStepHint(marketId = "uk") {
  return getMarketLabelPack(marketId).permitStepHint;
}

/** @param {MarketId} marketId */
export function getBriefingStepLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).briefingStepLabel;
}

/** @param {MarketId} marketId */
export function getBriefingStepHint(marketId = "uk") {
  return getMarketLabelPack(marketId).briefingStepHint;
}

/** Short register-family label for the market: HSE (UK), WHS (AU), BHP (PL). */
/** @param {MarketId} marketId */
export function getRegistersLabel(marketId = "uk") {
  return getMarketLabelPack(marketId).registersLabel || "HSE";
}

const MARKET_CURRENCY_SYMBOLS = { uk: "£", au: "A$", pl: "zł" };

/** Currency symbol for billing UI badges — avoids showing £ to AU/PL orgs. */
/** @param {MarketId} marketId */
export function getMarketCurrencySymbol(marketId = "uk") {
  return MARKET_CURRENCY_SYMBOLS[marketId] || MARKET_CURRENCY_SYMBOLS.uk;
}

/** @param {MarketId} marketId @param {string} planId */
export function getMarketPlanPriceLabel(planId, marketId = "uk") {
  if (marketId === "au" && AU_PLAN_PRICE_LABELS[planId]) return AU_PLAN_PRICE_LABELS[planId];
  if (marketId === "pl" && PL_PLAN_PRICE_LABELS[planId]) return PL_PLAN_PRICE_LABELS[planId];
  return null;
}

/** Replace UK-centric RAMS/CDM terms in profile copy for AU/PL markets. */
/** @param {string} text @param {MarketId} [marketId] */
export function localizeIndustryTerminology(text, marketId = "uk") {
  if (!text || marketId === "uk") return String(text || "");
  const rams = getRamsShortLabel(marketId);
  const compliance = getMarketLabelPack(marketId).registersLabel === "WHS"
    ? "WHS"
    : marketId === "pl"
    ? "Plan BHP"
    : "CDM";
  let out = String(text).replace(/\bRAMS\b/g, rams);
  out = out.replace(/\bCDM pack\b/gi, `${compliance} pack`);
  out = out.replace(/\bCDM packs\b/gi, `${compliance} packs`);
  out = out.replace(/\bCDM\b/g, compliance);
  out = out.replace(/\bRAMS builder\b/gi, `${rams} builder`);
  out = out.replace(/\bgeospatial RAMS\b/gi, `geospatial ${rams}`);
  out = out.replace(/\bRAMS packs\b/gi, `${rams} packs`);
  out = out.replace(/\bRAMS documents\b/gi, `${rams} documents`);
  if (marketId === "au") {
    out = out.replace(/\bMethod statements\b/gi, "SWMS");
  }
  return out;
}
