/**
 * Australian WHS legislation reference — model laws + common construction codes.
 * State-specific regulations may vary; customers remain responsible for applicability.
 */

/** @typedef {{ id: string, shortName: string, fullName: string, sectors: string[], summary: string, url?: string }} LegislationRef */

/** @type {LegislationRef[]} */
export const AU_LEGISLATION_LIBRARY = [
  {
    id: "whs_act",
    shortName: "WHS Act 2011",
    fullName: "Model Work Health and Safety Act 2011",
    sectors: ["all"],
    summary: "Primary duties of PCBU, officers, workers, and consultation.",
    url: "https://www.safeworkaustralia.gov.au/law-and-regulation/model-whs-laws",
  },
  {
    id: "whs_regs",
    shortName: "WHS Regs 2011",
    fullName: "Model Work Health and Safety Regulations 2011",
    sectors: ["all"],
    summary: "High-risk work, licensing, plant, hazardous chemicals, and more.",
    url: "https://www.safeworkaustralia.gov.au/law-and-regulation/model-whs-laws",
  },
  {
    id: "whs_construction",
    shortName: "WHS Construction",
    fullName: "Model Code of Practice — Construction work",
    sectors: ["construction"],
    summary: "SWMS, high-risk construction work, site induction, and principal contractor duties.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-construction-work",
  },
  {
    id: "whs_heights",
    shortName: "WHS Heights",
    fullName: "Model Code of Practice — Managing the risk of falls at workplaces",
    sectors: ["construction", "industrial"],
    summary: "Hierarchy of controls for work at height.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-managing-risk-falls-workplaces",
  },
  {
    id: "whs_confined",
    shortName: "WHS Confined spaces",
    fullName: "Model Code of Practice — Confined spaces",
    sectors: ["construction", "utilities"],
    summary: "Entry permits, atmospheric testing, and rescue planning.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-confined-spaces",
  },
  {
    id: "whs_excavation",
    shortName: "WHS Excavation",
    fullName: "Model Code of Practice — Excavation work",
    sectors: ["construction", "utilities"],
    summary: "Utility locate, shoring, and permit-to-dig controls.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-excavation-work",
  },
  {
    id: "whs_hazchem",
    shortName: "Hazardous chemicals",
    fullName: "Model Code of Practice — Managing risks of hazardous chemicals in the workplace",
    sectors: ["all"],
    summary: "SDS, registers, and exposure controls.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-managing-risks-hazardous-chemicals-workplace",
  },
  {
    id: "whs_noise",
    shortName: "WHS Noise",
    fullName: "Model Code of Practice — Managing noise and preventing hearing loss at work",
    sectors: ["construction", "industrial"],
    summary: "Exposure standards and hearing protection programs.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-managing-noise-and-preventing-hearing-loss-work",
  },
  {
    id: "whs_plant",
    shortName: "WHS Plant",
    fullName: "Model Code of Practice — Managing risks of plant in the workplace",
    sectors: ["construction", "industrial"],
    summary: "Design, inspection, and maintenance of plant.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-managing-risks-plant-workplace",
  },
  {
    id: "whs_asbestos",
    shortName: "WHS Asbestos",
    fullName: "Model Code of Practice — How to manage and control asbestos in the workplace",
    sectors: ["construction"],
    summary: "Asbestos register, removal, and licensed work.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-how-manage-and-control-asbestos-workplace",
  },
  {
    id: "whs_electrical",
    shortName: "WHS Electrical",
    fullName: "Model Code of Practice — Managing electrical risks in the workplace",
    sectors: ["construction", "industrial"],
    summary: "Isolation, testing, and live work controls.",
    url: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-managing-electrical-risks-workplace",
  },
  {
    id: "whs_lifting",
    shortName: "WHS Lifting",
    fullName: "Model Code of Practice — Safe work Australia crane, hoist and sling guidance",
    sectors: ["construction", "industrial"],
    summary: "Lift planning, rigging, and equipment inspection.",
    url: "https://www.safeworkaustralia.gov.au/law-and-regulation/model-whs-laws",
  },
];

/** @param {string} [sector] */
export function legislationForSector(sector) {
  if (!sector) return AU_LEGISLATION_LIBRARY;
  return AU_LEGISLATION_LIBRARY.filter((l) => l.sectors.includes("all") || l.sectors.includes(sector));
}

/** Seed org register from library */
export function seedLegislationRegister() {
  const now = new Date().toISOString();
  return AU_LEGISLATION_LIBRARY.map((l) => ({
    id: `leg_${l.id}`,
    refId: l.id,
    shortName: l.shortName,
    fullName: l.fullName,
    sectors: l.sectors,
    summary: l.summary,
    url: l.url || "",
    applicable: l.sectors.includes("all") || l.sectors.includes("construction"),
    lastReviewed: "",
    nextReview: "",
    notes: "",
    createdAt: now,
  }));
}
