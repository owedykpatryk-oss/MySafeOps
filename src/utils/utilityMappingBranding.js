/**
 * Default branding for Utility Mapping (u-map.co.uk) — navy / cyan from corporate identity.
 * Applied only when the Utility Mapping exclusive pack is used.
 */
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
  industrySectors: ["construction"],
};

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
      (key === "name" && (cur === "My Organisation" || cur === "My Organization")) ||
      (key === "primaryColor" && cur === "#0d9488") ||
      (key === "accentColor" && (cur === "#f97316" || cur === "#0f766e")) ||
      (key === "address" && String(cur).includes("Studio 3 The Locks")) ||
      (key === "email" && cur === "patryk@u-map.co.uk");
    if (empty || forceAsset) next[key] = value;
  }
  return next;
}
