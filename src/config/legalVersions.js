/** Bump when static legal HTML changes materially (stored in Supabase user_metadata on sign-up). */
export const LEGAL_VERSIONS = {
  uk: {
    terms: "2.2",
    privacy: "2026-07",
    cookies: "2026-07",
  },
  au: {
    terms: "1.0-au",
    privacy: "2026-07-au",
    cookies: "2026-07-au",
  },
  pl: {
    terms: "1.0-pl",
    privacy: "2026-07-pl",
    cookies: "2026-07-pl",
  },
};

/** @param {import("./markets").MarketId} marketId */
export function getLegalVersions(marketId) {
  return LEGAL_VERSIONS[marketId] ?? LEGAL_VERSIONS.uk;
}
