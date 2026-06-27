import { RAMS_FEATURES } from "../utils/ramsFeatureIds";

/** Default Organisation settings for FESS Group (Settings → Apply preset). */
export const FESS_ORG_SLUG = "fess-group";

/** Only these accounts may belong to org slug `fess-group`. Everyone else gets a solo org or joins via invite elsewhere. */
export const FESS_RESERVED_MEMBER_EMAILS = [
  "jack@fessgroup.co.uk",
  "maciej@fessgroup.co.uk",
];

export function isFessOrgSlug(slug) {
  return String(slug || "").trim().toLowerCase() === FESS_ORG_SLUG;
}

export function isFessReservedMemberEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return FESS_RESERVED_MEMBER_EMAILS.includes(e);
}

export const FESS_ORG_BRANDING_BASE = {
  name: "FESS Group",
  website: "https://pl.fessgroup.co.uk/",
  address: "FESS Group\nUnited Kingdom",
  phone: "",
  email: "",
  primaryColor: "#f97316",
  accentColor: "#0f172a",
  pdfHeader: "FESS Group — Health & Safety Documentation",
  pdfFooter: "FESS Group · mysafeops.com",
  pdfTheme: "executive",
  pdfVersionPrefix: "FESS",
  pdfWatermarkText: "",
  pdfComplianceLine: "Controlled document. Ensure latest approved revision is in use.",
  defaultLeadEngineer: "",
  industrySectors: ["construction", "food_beverage", "pet_food", "pharma", "petrochem"],
  /** FESS does not use PAS128 / geodesy packs in RAMS. */
  hiddenFeatures: [RAMS_FEATURES.SURVEYING],
};

export const FESS_LOGO_PUBLIC_PATH = "/branding/fess-group-logo.png";

/** @returns {Promise<Record<string, unknown>>} */
export async function buildFessOrgBrandingPreset() {
  let logo = null;
  try {
    const res = await fetch(FESS_LOGO_PUBLIC_PATH);
    if (res.ok) {
      const blob = await res.blob();
      logo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    /* offline or missing asset */
  }
  return {
    ...FESS_ORG_BRANDING_BASE,
    logo,
  };
}
