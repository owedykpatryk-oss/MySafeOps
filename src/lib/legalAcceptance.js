import { getLegalVersions } from "../config/legalVersions";
import { resolveMarketId } from "../config/markets";

/**
 * Metadata written to Supabase Auth `user_metadata` when a user accepts Terms + Privacy at sign-up.
 * @param {Date} [now]
 * @param {import("../config/markets").MarketId} [marketId]
 * @returns {Record<string, string>}
 */
export function buildLegalAcceptanceMetadata(now = new Date(), marketId = "uk") {
  const market = resolveMarketId(marketId);
  const versions = getLegalVersions(market);
  const acceptedAt = now.toISOString();
  return {
    market,
    terms_accepted_at: acceptedAt,
    terms_version: versions.terms,
    privacy_accepted_at: acceptedAt,
    privacy_version: versions.privacy,
  };
}
