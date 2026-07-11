import { LEGAL_VERSIONS } from "../config/legalVersions";

/**
 * Metadata written to Supabase Auth `user_metadata` when a user accepts Terms + Privacy at sign-up.
 * @returns {Record<string, string>}
 */
export function buildLegalAcceptanceMetadata(now = new Date()) {
  const acceptedAt = now.toISOString();
  return {
    terms_accepted_at: acceptedAt,
    terms_version: LEGAL_VERSIONS.terms,
    privacy_accepted_at: acceptedAt,
    privacy_version: LEGAL_VERSIONS.privacy,
  };
}
