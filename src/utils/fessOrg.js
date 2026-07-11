/**
 * FESS Group org detection — used for org-exclusive workspace profile, packs and modules.
 */
import { getOrgId } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";

/** Canonical Supabase / provision slug (scripts/provision-fess-group.mjs). */
export const FESS_ORG_SLUGS = new Set(["fess-group", "fess_group"]);

/**
 * @param {string} [orgId]
 * @param {Record<string, unknown>} [settings]
 */
export function isFessOrg(orgId = getOrgId(), settings = loadOrgSettingsRaw()) {
  const slug = String(orgId || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (FESS_ORG_SLUGS.has(slug)) return true;
  const name = String(settings?.name || "")
    .trim()
    .toLowerCase();
  if (name.includes("fess group") || name === "fess") return true;
  return false;
}
