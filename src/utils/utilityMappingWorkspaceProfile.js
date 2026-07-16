/**
 * Utility Mapping (u-map.co.uk) workspace profile — visible/applicable only when isUtilityMappingOrg().
 * PAS128 survey / GPR deliverables, RAMS, geo-photos, and permit to dig.
 */
export const UTILITY_MAPPING_PACK_ID = "utilityMapping";

/** Canonical Supabase / provision slugs for Utility Mapping. */
export const UTILITY_MAPPING_ORG_SLUGS = new Set([
  "utility-mapping",
  "utility_mapping",
  "u-map",
  "umap",
  "utility-mapping-group",
  "utility_mapping_group",
]);

/** Lightweight tenant check for profile lists (no orgStorage cycle). */
export function isUtilityMappingOrgForWorkspaceList(orgId, settings = {}) {
  const slug = String(orgId || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (UTILITY_MAPPING_ORG_SLUGS.has(slug)) return true;
  const name = String(settings?.name || "")
    .trim()
    .toLowerCase();
  if (name.includes("utility mapping") || name === "u-map" || name === "umap") return true;
  const website = String(settings?.website || "")
    .trim()
    .toLowerCase();
  if (website.includes("u-map.co.uk")) return true;
  const email = String(settings?.email || "")
    .trim()
    .toLowerCase();
  if (email.endsWith("@u-map.co.uk")) return true;
  return false;
}

/** @returns {boolean} */
export function isUtilityMappingExclusivePackId(packId) {
  return String(packId || "").trim() === UTILITY_MAPPING_PACK_ID;
}

/** @returns {object} Utility Mapping workspace profile (org-exclusive). */
export function getUtilityMappingWorkspacePack() {
  return {
    label: "Utility Mapping — PAS128 & GPR",
    hint: "PAS128 utility / topo+utility, GPR, EML, geo-photos, RAMS and permit to dig. No CCTV, drone or laser modules — branded covers for this organisation only.",
    hidePreset: "surveyingFocus",
    showModules: [
      "survey-report",
      "gpr-report",
      "geo-photos",
      "rams",
      "permits",
      "method-statement",
      "daily-briefing",
      "construction-setup",
    ],
    hiddenModules: [
      "allergen-changeovers",
      "gmp-deviations",
      "high-care-access",
      "cip-signoff",
      "ghp-register",
      "hygiene-setup",
      "fess-setup",
      "fess-sites",
      "asbestos",
      "electrical-pat",
      "plant",
    ],
    industrySectors: ["construction"],
    ramsStarterKey: "geospatial_intelligence",
    surveyWorkflow: true,
    orgExclusive: true,
  };
}
