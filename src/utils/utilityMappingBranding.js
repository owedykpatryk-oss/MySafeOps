/**
 * Default branding for Utility Mapping (u-map.co.uk) — navy / cyan from corporate identity.
 * Applied only when the Utility Mapping exclusive pack is used.
 */
import { getOrgId } from "./orgId";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

export const UTILITY_MAPPING_BRAND = {
  name: "Utility Mapping",
  website: "https://u-map.co.uk/",
  address: "6 Paynes Lane, 1st Floor, Rugby, CV21 2UH",
  phone: "0800 024 UMAP",
  email: "info@u-map.co.uk",
  primaryColor: "#0B1D3A",
  accentColor: "#00B4E4",
  pdfHeader: "Utility Mapping — PAS 128 Utility Survey Reports",
  pdfFooter: "Utility Mapping · u-map.co.uk · Part of IS GROUP",
  pdfTheme: "executive",
  pdfVersionPrefix: "UM",
  pdfWatermarkText: "",
  pdfComplianceLine: "Controlled document. Ensure the latest approved revision is in use.",
  logoUrl: "/branding/utility-mapping-logo.png",
  coverHeroUrl: "/branding/utility-mapping/cover-hero.jpg",
  letterheadUrl: "/branding/utility-mapping/letterhead.jpg",
  industrySectors: [
    "construction",
    "surveying_pas128",
    "surveying_topo",
    "surveying_geospatial",
    "surveying_gpr",
  ],
};

const PLACEHOLDER_PRIMARIES = new Set(["#0d9488", "#0c447c", "#0D9488", "#0C447C"]);
const PLACEHOLDER_ACCENTS = new Set(["#f97316", "#0f766e", "#F97316", "#0F766E"]);

/**
 * Merge Utility Mapping brand defaults into org settings without overwriting user-set fields.
 * Always refreshes logoUrl / cover asset paths for this tenant.
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
export function mergeUtilityMappingBrandingDefaults(raw = {}) {
  const next = { ...raw };
  for (const [key, value] of Object.entries(UTILITY_MAPPING_BRAND)) {
    const cur = next[key];
    const forceAsset =
      key === "logoUrl" || key === "coverHeroUrl" || key === "letterheadUrl";
    const empty =
      cur == null ||
      cur === "" ||
      (key === "name" &&
        (cur === "My Organisation" ||
          cur === "My Organization" ||
          / workspace$/i.test(String(cur)))) ||
      (key === "primaryColor" && PLACEHOLDER_PRIMARIES.has(String(cur))) ||
      (key === "accentColor" && PLACEHOLDER_ACCENTS.has(String(cur))) ||
      (key === "address" && String(cur).includes("Studio 3 The Locks")) ||
      (key === "email" && cur === "patryk@u-map.co.uk");
    if (empty || forceAsset) next[key] = value;
  }
  // PWA / shell reads `logo` — use public asset path when no embedded data URL yet.
  const logo = typeof next.logo === "string" ? next.logo : "";
  if ((!logo || logo === "/branding/mysafeops-logo.png") && next.logoUrl) {
    next.logo = next.logoUrl;
  }
  return next;
}

/**
 * Persist navy/cyan branding + logo for the Utility Mapping tenant on app boot.
 * Does not wait for the setup wizard "Apply profile" step.
 * @param {string} [orgId]
 * @param {{ force?: boolean }} [opts] force=true when auth email is @u-map.co.uk but local settings not yet gated
 * @returns {boolean} true when settings were written
 */
export function ensureUtilityMappingBranding(orgId = getOrgId(), opts = {}) {
  const raw = loadOrgSettingsRaw(orgId);
  if (!opts.force && !isUtilityMappingOrg(orgId, raw)) return false;
  const next = mergeUtilityMappingBrandingDefaults(raw);

  const packId = String(next.industryPackId || "").trim();
  if (!packId || packId === "surveyingGeodesy" || packId === "generalContractor") {
    next.industryPackId = UTILITY_MAPPING_PACK_ID;
  }

  const pick = (s) =>
    JSON.stringify({
      name: s.name,
      logo: s.logo,
      logoUrl: s.logoUrl,
      primaryColor: s.primaryColor,
      accentColor: s.accentColor,
      website: s.website,
      industryPackId: s.industryPackId,
      pdfHeader: s.pdfHeader,
    });
  if (pick(raw) === pick(next)) return false;
  saveOrgSettingsRaw(next, orgId);
  return true;
}
