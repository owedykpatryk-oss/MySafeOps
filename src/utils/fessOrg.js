/**
 * FESS Group org detection — used for org-exclusive workspace profile, packs and modules.
 */
import { getOrgId } from "./orgId";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";

import { FESS_ORG_SLUGS } from "./fessWorkspaceProfile";

export { FESS_ORG_SLUGS } from "./fessWorkspaceProfile";

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
