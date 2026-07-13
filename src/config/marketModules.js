/** @typedef {import("./markets").MarketId} MarketId */

/**
 * Workspace modules shown only for the given market.
 * Hard-gated in isModuleVisible — not overridable via “unhide” in Settings.
 */

/** UK-only compliance & standards modules. */
export const UK_ONLY_MODULE_IDS = [
  "cdm",
  "riddor",
  "dsear",
  "survey-report",
  "gpr-report",
  "electrical-pat",
];

/** Market-specific compliance modules (reuse CDM/RIDDOR components with regional content). */
export const REGION_COMPLIANCE_MODULE_IDS = {
  au: ["whs-plan"],
  pl: ["bhp-plan"],
};

/** Shared across non-UK markets only. */
export const MULTI_REGION_MODULE_IDS = ["notifiable-incidents"];

/** @deprecated Use REGION_COMPLIANCE_MODULE_IDS.au + MULTI_REGION_MODULE_IDS */
export const AU_ONLY_MODULE_IDS = [...REGION_COMPLIANCE_MODULE_IDS.au, ...MULTI_REGION_MODULE_IDS];

/** @deprecated Use REGION_COMPLIANCE_MODULE_IDS.pl + MULTI_REGION_MODULE_IDS */
export const PL_ONLY_MODULE_IDS = [...REGION_COMPLIANCE_MODULE_IDS.pl, ...MULTI_REGION_MODULE_IDS];

/** RAMS builder sub-features gated by market. */
export const UK_ONLY_RAMS_FEATURES = ["rams/surveying"];
export const AU_ONLY_RAMS_FEATURES = [];

/** Default hidden RAMS features when bootstrapping a new org (merged with user hides). */
export const MARKET_DEFAULT_HIDDEN_FEATURES = {
  uk: [],
  au: ["rams/surveying", "rams/allergen"],
  pl: ["rams/surveying", "rams/allergen"],
};

/** Extra modules hidden on first bootstrap (slim menu) — market-specific additions. */
export const MARKET_BOOTSTRAP_EXTRA_HIDDEN = {
  uk: [],
  au: [],
  pl: [],
};

/** Slim More menu for typical construction (bootstrap on first load). */
export const CONSTRUCTION_SLIM_HIDDEN = [
  "site-map",
  "enterprise-readiness",
  "client-acquisition",
  "sales-enablement",
  "high-care-access",
  "cip-signoff",
  "allergen-changeovers",
  "gmp-deviations",
  "incident-map",
  "client-portal",
  "subcontractor",
  "analytics",
  "monthly-report",
  "templates",
  "backup",
  "audit",
];

/** @param {string} moduleId @param {MarketId} marketId */
export function isModuleAllowedForMarket(moduleId, marketId) {
  const id = String(moduleId || "");
  if (!id) return false;
  if (UK_ONLY_MODULE_IDS.includes(id) && marketId !== "uk") return false;
  if (MULTI_REGION_MODULE_IDS.includes(id)) {
    return marketId === "au" || marketId === "pl";
  }
  for (const [region, ids] of Object.entries(REGION_COMPLIANCE_MODULE_IDS)) {
    if (ids.includes(id) && marketId !== region) return false;
  }
  return true;
}

/** @param {string} featureId @param {MarketId} marketId */
export function isFeatureAllowedForMarket(featureId, marketId) {
  const id = String(featureId || "");
  if (!id) return true;
  if (UK_ONLY_RAMS_FEATURES.includes(id) && marketId !== "uk") return false;
  if (AU_ONLY_RAMS_FEATURES.includes(id) && marketId !== "au") return false;
  return true;
}

/** @param {MarketId} marketId */
export function getMarketDefaultHiddenFeatures(marketId) {
  return [...(MARKET_DEFAULT_HIDDEN_FEATURES[marketId] ?? MARKET_DEFAULT_HIDDEN_FEATURES.uk)];
}

/** @param {MarketId} marketId */
export function getMarketBootstrapExtraHidden(marketId) {
  return [...(MARKET_BOOTSTRAP_EXTRA_HIDDEN[marketId] ?? [])];
}

/** Human-readable note for Settings UI. */
export const MARKET_PACK_HINTS = {
  uk: "UK pack: CDM, RIDDOR, PAS128 survey, COSHH, LOLER/PAT and HSE-focused modules.",
  au: "Australia pack: WHS plan, notifiable incidents, SWMS, model WHS legislation — UK-only modules (CDM, RIDDOR, PAS128, DSEAR, PAT) are hidden.",
  pl: "Pakiet PL: plan BHP, zdarzenia do zgłoszenia PIP, IOR, pozwolenia na pracę — moduły UK/AU (CDM, RIDDOR, PAS128, SWMS-only) są ukryte.",
};
