/**
 * FESS Group workspace profile — visible and applicable only when isFessOrg() is true.
 */
export const FESS_GROUP_PACK_ID = "fessGroup";

/** @returns {boolean} */
export function isFessExclusivePackId(packId) {
  return String(packId || "").trim() === FESS_GROUP_PACK_ID;
}

/** @returns {object} FESS Group workspace profile (org-exclusive). */
export function getFessGroupWorkspacePack() {
  return {
    label: "FESS Group — food factory M&E",
    hint: "M&E on live food sites — standard site RA baseline, hygiene registers, LOTO, line clearance and method statements.",
    hidePreset: "foodPharmaFocus",
    hiddenModules: ["survey-report", "hygiene-setup"],
    showModules: [
      "fess-setup",
      "fess-sites",
      "allergen-changeovers",
      "gmp-deviations",
      "high-care-access",
      "cip-signoff",
      "ghp-register",
      "dynamic-ra",
      "legislation",
      "loto",
      "method-statement",
      "hot-work",
      "client-portal",
    ],
    industrySectors: ["construction", "food_beverage", "pharma", "pet_food"],
    ramsStarterKey: "general",
    surveyWorkflow: false,
    orgExclusive: true,
  };
}
