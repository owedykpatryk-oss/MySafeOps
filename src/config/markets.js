/**
 * Regional compliance packs. One organisation may own multiple paid country
 * workspaces; the active workspace selects the current market pack.
 *
 * Adding a market — touch in order:
 * 1. MARKETS entry below (+ App.jsx routes, public/legal/{id}/)
 * 2. marketModules.js — UK_ONLY / XX_ONLY module ids
 * 3. compliancePackContent.js + notifiableIncidentsContent.js
 * 4. {id}Pricing.js + Stripe STRIPE_PRICE_*_{CURRENCY} + landingMarketContent.js
 * 5. certifications.js + permitTypesMarket.js + constructionQuickPacks.js
 * 6. legislation library + postcode/weather adapter in siteAddressLookup.js
 * 7. legalVersions.js + markets.test.js
 */

/** @typedef {'uk' | 'au' | 'pl'} MarketId */

/** @typedef {{
 *   id: MarketId;
 *   label: string;
 *   flag: string;
 *   locale: string;
 *   ogLocale: string;
 *   currency: string;
 *   homePath: string;
 *   legalBasePath: string;
 *   privacyPath: string;
 *   termsPath: string;
 *   cookiesPath: string;
 *   dpaPath: string;
 *   accessibilityPath: string;
 *   loginPath: string;
 *   alternateMarketId: MarketId; // primary switcher hint only — use getAlternateMarkets() for hreflang
 *   legislationLibraryId: string;
 * }} MarketConfig */

/** @type {Record<MarketId, MarketConfig>} */
export const MARKETS = {
  uk: {
    id: "uk",
    label: "United Kingdom",
    flag: "🇬🇧",
    locale: "en-GB",
    ogLocale: "en_GB",
    currency: "GBP",
    homePath: "/",
    legalBasePath: "/legal",
    privacyPath: "/privacy",
    termsPath: "/terms",
    cookiesPath: "/cookies",
    dpaPath: "/dpa",
    accessibilityPath: "/accessibility",
    loginPath: "/login",
    alternateMarketId: "au",
    legislationLibraryId: "uk",
  },
  au: {
    id: "au",
    label: "Australia",
    flag: "🇦🇺",
    locale: "en-AU",
    ogLocale: "en_AU",
    currency: "AUD",
    homePath: "/au",
    legalBasePath: "/legal/au",
    privacyPath: "/au/privacy",
    termsPath: "/au/terms",
    cookiesPath: "/au/cookies",
    dpaPath: "/au/dpa",
    accessibilityPath: "/au/accessibility",
    loginPath: "/login?market=au",
    alternateMarketId: "uk",
    legislationLibraryId: "au",
  },
  pl: {
    id: "pl",
    label: "Polska",
    flag: "🇵🇱",
    locale: "pl-PL",
    ogLocale: "pl_PL",
    currency: "PLN",
    homePath: "/pl",
    legalBasePath: "/legal/pl",
    privacyPath: "/pl/privacy",
    termsPath: "/pl/terms",
    cookiesPath: "/pl/cookies",
    dpaPath: "/pl/dpa",
    accessibilityPath: "/pl/accessibility",
    loginPath: "/login?market=pl",
    alternateMarketId: "uk",
    legislationLibraryId: "pl",
  },
};

export const DEFAULT_MARKET_ID = /** @type {const} */ ("uk");

/** @type {MarketId[]} */
export const MARKET_IDS = /** @type {const} */ (Object.keys(MARKETS));

/** @param {string | null | undefined} id */
export function isValidMarketId(id) {
  return typeof id === "string" && id in MARKETS;
}

/** @param {string | null | undefined} id */
export function resolveMarketId(id) {
  if (isValidMarketId(id)) return /** @type {MarketId} */ (id);
  return DEFAULT_MARKET_ID;
}

/** @param {MarketId} marketId */
export function getMarket(marketId) {
  return MARKETS[resolveMarketId(marketId)] ?? MARKETS.uk;
}

/** @param {MarketId} marketId */
export function getMarketLoginTo(marketId) {
  return getMarket(marketId).loginPath;
}

/** Other live markets for landing region switcher. */
export function getAlternateMarkets(currentId) {
  return MARKET_IDS.filter((id) => id !== resolveMarketId(currentId)).map((id) => getMarket(id));
}

/** @param {MarketId} marketId */
export function legalDocIframeSrc(marketId, docFileName) {
  const market = getMarket(marketId);
  return `${market.legalBasePath}/${docFileName}`;
}
