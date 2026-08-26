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
  de: {
    terms: "1.0-de",
    privacy: "2026-08-de.5",
    cookies: "2026-08-de",
  },
  at: {
    terms: "1.0-at",
    privacy: "2026-08-at",
    cookies: "2026-08-at",
  },
  ch: {
    terms: "1.0-ch",
    privacy: "2026-08-ch",
    cookies: "2026-08-ch",
  },
};

/** @param {import("./markets").MarketId} marketId */
export function getLegalVersions(marketId) {
  return LEGAL_VERSIONS[marketId] ?? LEGAL_VERSIONS.uk;
}
