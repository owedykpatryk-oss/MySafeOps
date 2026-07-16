/**
 * Utility Mapping org detection — used for org-exclusive workspace profile and branded covers.
 */
import { getOrgId } from "./orgId";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import {
  UTILITY_MAPPING_ORG_SLUGS,
  isUtilityMappingOrgForWorkspaceList,
} from "./utilityMappingWorkspaceProfile";

export { UTILITY_MAPPING_ORG_SLUGS } from "./utilityMappingWorkspaceProfile";

/**
 * @param {string} [orgId]
 * @param {Record<string, unknown>} [settings]
 */
export function isUtilityMappingOrg(orgId = getOrgId(), settings) {
  const id = String(orgId || getOrgId() || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  // When probing another org id, only trust the slug — do not reuse the active org's name/email.
  if (settings == null && id && id !== String(getOrgId() || "").trim().toLowerCase().replace(/_/g, "-")) {
    return UTILITY_MAPPING_ORG_SLUGS.has(id);
  }
  return isUtilityMappingOrgForWorkspaceList(orgId, settings ?? loadOrgSettingsRaw());
}
