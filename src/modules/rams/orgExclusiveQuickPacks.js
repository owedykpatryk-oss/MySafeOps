/**
 * Hazard quick packs seeded only for org-exclusive tenants (not global built-ins).
 */
import { buildPackFromDef } from "./constructionQuickPacks.js";
import { isFessOrg } from "../../utils/fessOrg.js";
import { isUtilityMappingOrg } from "../../utils/utilityMappingOrg.js";
import { UM_ORG_EXCLUSIVE_PACK_DEFS } from "../../utils/utilityMappingQuickPacks.js";

/** Verbatim fess_001…fess_021 rows from FESS Excel master (org-exclusive). */
export const FESS_EXCEL_BASELINE_PACK_DEF = {
  id: "orgexclusive_fess_excel_baseline",
  name: "FESS Excel RA baseline (verbatim)",
  sector: "food_pharma",
  pinned: true,
  orgExclusive: true,
  description:
    "First 21 hazard rows from the FESS Excel RAMS master — allergen zones, product lines, LOTO, hygiene and M&E site risks in original wording.",
  hazardIds: Array.from({ length: 21 }, (_, i) => `fess_${String(i + 1).padStart(3, "0")}`),
};

/** ~21 standard M&E site rows from FESS Excel RAMS workflow (mapped to ramsHazardLibrary ids). */
export const FESS_ME_SITE_BASELINE_PACK_DEF = {
  id: "orgexclusive_fess_me_site_baseline",
  name: "Standard site RA baseline",
  sector: "food_pharma",
  pinned: true,
  orgExclusive: true,
  description:
    "Core M&E site risks for every food factory job — slips/trips, hand tools, isolation, height, confined spaces, commissioning and food-zone controls.",
  hazardIds: [
    "gen_001",
    "elec_001",
    "elec_002",
    "elec_003",
    "drill_001",
    "elec_004",
    "drill_002",
    "wah_003",
    "mh_001",
    "gen_003",
    "drill_004",
    "gen_002",
    "elec_006",
    "wah_001",
    "elec_007",
    "drill_003",
    "mech_002",
    "mach_003",
    "mech_001",
    "elec_005",
    "food_001",
    "food_002",
  ],
};

/** Site-specific hazard add-ons (merged with job starter baseline). */
export const FESS_SITE_HAZARD_PACK_DEFS = [
  {
    id: "orgexclusive_fess_site_2sfg",
    name: "2SFG — line clearance & allergen",
    sector: "food_pharma",
    pinned: false,
    orgExclusive: true,
    siteTemplateIds: ["fess_site_2sfg_scunthorpe", "fess_site_2sfg_flixton"],
    description: "Production line clearance, allergen zone and open-product controls for 2 Sisters sites.",
    hazardIds: ["fess_001", "fess_002", "fess_009", "fess_010"],
  },
  {
    id: "orgexclusive_fess_site_cranswick",
    name: "Cranswick — wash / roof void hygiene",
    sector: "food_pharma",
    pinned: false,
    orgExclusive: true,
    siteTemplateIds: ["fess_site_cranswick_lazenby"],
    description: "Wash station, roof void and CIP hygiene interface hazards.",
    hazardIds: ["fess_003", "fess_012", "fess_013"],
  },
  {
    id: "orgexclusive_fess_site_quorn",
    name: "Quorn — allergen & evap tower",
    sector: "food_pharma",
    pinned: false,
    orgExclusive: true,
    siteTemplateIds: ["fess_site_quorn"],
    description: "Allergen briefing and height works adjacent to evaporation tower.",
    hazardIds: ["fess_001", "fess_010", "fess_011"],
  },
  {
    id: "orgexclusive_fess_site_butternut",
    name: "Butternut — production & foreign body",
    sector: "food_pharma",
    pinned: false,
    orgExclusive: true,
    siteTemplateIds: ["fess_site_butternut"],
    description: "Open product, conveyor and foreign-body prevention on pet-food production lines.",
    hazardIds: ["fess_002", "fess_014", "food_001"],
  },
  {
    id: "orgexclusive_fess_site_dovecoat",
    name: "Dovecoat — machine install & lifting",
    sector: "food_pharma",
    pinned: false,
    orgExclusive: true,
    siteTemplateIds: ["fess_site_dovecoat"],
    description: "Machine placement, lifting and product-zone controls for Dovecoat Park.",
    hazardIds: ["fess_002", "fess_015", "lift_001"],
  },
];

const ORG_EXCLUSIVE_PACK_DEFS = [
  FESS_ME_SITE_BASELINE_PACK_DEF,
  FESS_EXCEL_BASELINE_PACK_DEF,
  ...FESS_SITE_HAZARD_PACK_DEFS,
];

/** @param {string} [packId] */
export function getFessOrgExclusivePackDef(packId) {
  return ORG_EXCLUSIVE_PACK_DEFS.find((p) => p.id === packId) || null;
}

/** @param {string} [siteTemplateId] */
export function getFessSiteHazardPackDef(siteTemplateId) {
  const id = String(siteTemplateId || "").trim();
  if (!id) return null;
  return FESS_SITE_HAZARD_PACK_DEFS.find((p) => (p.siteTemplateIds || []).includes(id)) || null;
}

/**
 * @param {string} [orgId]
 */
export function orgExclusivePackDefsForOrg(orgId) {
  if (isFessOrg(orgId)) return ORG_EXCLUSIVE_PACK_DEFS;
  if (isUtilityMappingOrg(orgId)) return UM_ORG_EXCLUSIVE_PACK_DEFS;
  return [];
}

/**
 * Merge org-exclusive packs when tenant matches.
 * @param {object[]} existingPacks
 * @param {object[]} allHazards
 * @param {string} [orgId]
 * @returns {object[]}
 */
export function ensureOrgExclusiveQuickPacks(existingPacks, allHazards, orgId) {
  const defs = orgExclusivePackDefsForOrg(orgId);
  if (!defs.length) {
    return (Array.isArray(existingPacks) ? existingPacks : []).filter((p) => !p?.orgExclusive);
  }
  const list = (Array.isArray(existingPacks) ? [...existingPacks] : []).filter((p) => {
    if (!p?.orgExclusive) return true;
    return defs.some((d) => d.id === p.id);
  });
  const existingIds = new Set(list.map((p) => p.id));
  const built = defs
    .filter((d) => !existingIds.has(d.id))
    .map((def) => {
      const pack = buildPackFromDef(allHazards, def);
      if (!pack) return null;
      return {
        ...pack,
        builtIn: false,
        orgExclusive: true,
        isPinned: !!def.pinned,
      };
    })
    .filter(Boolean);
  return [...built, ...list];
}

/** Hide org-exclusive packs that do not belong to the current tenant. */
export function filterQuickPacksForOrg(packs, orgId) {
  const list = Array.isArray(packs) ? packs : [];
  const allowed = new Set(orgExclusivePackDefsForOrg(orgId).map((d) => d.id));
  return list.filter((p) => !p?.orgExclusive || allowed.has(p.id));
}
