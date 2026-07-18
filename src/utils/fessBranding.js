/**
 * Default branding for FESS Group — orange / navy food-factory identity.
 * Applied only for the FESS exclusive tenant (slug fess-group).
 */
import { getOrgId } from "./orgId";
import { isFessOrg } from "./fessOrg";
import { FESS_GROUP_PACK_ID } from "./fessWorkspaceProfile";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

export const FESS_BRAND = {
  name: "FESS Group",
  website: "https://pl.fessgroup.co.uk/",
  address: "FESS Group\nUnited Kingdom",
  phone: "",
  email: "",
  primaryColor: "#f97316",
  accentColor: "#0f172a",
  pdfHeader: "FESS Group — Health & Safety Documentation",
  pdfFooter: "FESS Group · Controlled document",
  pdfTheme: "executive",
  pdfVersionPrefix: "FESS",
  pdfWatermarkText: "",
  pdfComplianceLine: "Controlled document. Ensure latest approved revision is in use.",
  logoUrl: "/branding/fess-group-logo.png",
  industrySectors: ["construction", "food_beverage", "pharma", "pet_food", "petrochem"],
};

/** MySafeOps defaults that should yield to FESS brand on this tenant. */
const PLACEHOLDER_PRIMARIES = new Set(["#0d9488", "#0c447c", "#0D9488", "#0C447C", "#0B1D3A"]);
const PLACEHOLDER_ACCENTS = new Set(["#0f766e", "#0F766E", "#00B4E4", "#f97316", "#F97316"]);
const PLACEHOLDER_LOGOS = new Set([
  "",
  "/branding/mysafeops-logo.png",
  "/branding/utility-mapping-logo.png",
]);

/**
 * @param {Record<string, unknown>} [org]
 * @returns {string}
 */
export function getFessBrandLogoSrc(org = loadOrgSettingsRaw()) {
  const logo = String(org?.logo || "").trim();
  if (logo && !PLACEHOLDER_LOGOS.has(logo)) return logo;
  const logoUrl = String(org?.logoUrl || "").trim();
  if (logoUrl) return logoUrl;
  return FESS_BRAND.logoUrl;
}

/**
 * Merge FESS brand defaults without overwriting user-customised fields.
 * Always refreshes logoUrl path for this tenant.
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
export function mergeFessBrandingDefaults(raw = {}) {
  const next = { ...raw };
  for (const [key, value] of Object.entries(FESS_BRAND)) {
    const cur = next[key];
    const forceAsset = key === "logoUrl";
    const empty =
      cur == null ||
      cur === "" ||
      (key === "name" &&
        (cur === "My Organisation" ||
          cur === "My Organization" ||
          / workspace$/i.test(String(cur)) ||
          String(cur).toLowerCase() === "fess")) ||
      (key === "primaryColor" && PLACEHOLDER_PRIMARIES.has(String(cur))) ||
      (key === "accentColor" &&
        (PLACEHOLDER_ACCENTS.has(String(cur)) || String(cur).toLowerCase() === "#0d9488")) ||
      (key === "pdfHeader" && String(cur).includes("MySafeOps")) ||
      (key === "pdfFooter" && (String(cur).includes("MySafeOps") || String(cur).includes("u-map"))) ||
      (key === "email" && cur === "patryk@u-map.co.uk");
    if (empty || forceAsset) next[key] = value;
  }
  // Orange primary is intentional for FESS — do not leave teal from prior packs.
  if (PLACEHOLDER_PRIMARIES.has(String(next.primaryColor || ""))) {
    next.primaryColor = FESS_BRAND.primaryColor;
  }
  if (!next.accentColor || PLACEHOLDER_ACCENTS.has(String(next.accentColor)) || String(next.accentColor) === FESS_BRAND.primaryColor) {
    next.accentColor = FESS_BRAND.accentColor;
  }
  const logo = typeof next.logo === "string" ? next.logo : "";
  if (!logo || PLACEHOLDER_LOGOS.has(logo)) {
    next.logo = next.logoUrl || FESS_BRAND.logoUrl;
  }
  return next;
}

/**
 * Persist FESS branding + logo on app boot (no wizard wait).
 * @param {string} [orgId]
 * @param {{ force?: boolean }} [opts]
 * @returns {boolean} true when settings were written
 */
export function ensureFessBranding(orgId = getOrgId(), opts = {}) {
  const raw = loadOrgSettingsRaw(orgId);
  if (!opts.force && !isFessOrg(orgId, raw)) return false;
  const next = mergeFessBrandingDefaults(raw);

  const packId = String(next.industryPackId || "").trim();
  if (!packId || packId === "generalContractor" || packId === "foodPharma" || packId === "surveyingGeodesy") {
    next.industryPackId = FESS_GROUP_PACK_ID;
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
      pdfFooter: s.pdfFooter,
    });
  if (pick(raw) === pick(next)) return false;
  saveOrgSettingsRaw(next, orgId);
  return true;
}
