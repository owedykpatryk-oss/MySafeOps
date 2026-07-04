/**
 * UK HSE legislation reference — cross-linked to RAMS sectors and food factory compliance.
 */

/** @typedef {{ id: string, shortName: string, fullName: string, sectors: string[], summary: string, url?: string }} LegislationRef */

/** @type {LegislationRef[]} */
export const UK_LEGISLATION_LIBRARY = [
  { id: "hasawa", shortName: "HASAWA 1974", fullName: "Health and Safety at Work etc. Act 1974", sectors: ["all"], summary: "General duties of employers and employees.", url: "https://www.legislation.gov.uk/ukpga/1974/37" },
  { id: "cdm2015", shortName: "CDM 2015", fullName: "Construction (Design and Management) Regulations 2015", sectors: ["construction"], summary: "Principal designer/contractor duties, pre-construction information, CPP.", url: "https://www.legislation.gov.uk/uksi/2015/51" },
  { id: "mhswr", shortName: "MHSWR 1999", fullName: "Management of Health and Safety at Work Regulations 1999", sectors: ["all"], summary: "Risk assessment, health surveillance, competent persons.", url: "https://www.legislation.gov.uk/uksi/1999/3242" },
  { id: "wah", shortName: "WAHR 2005", fullName: "Work at Height Regulations 2005", sectors: ["construction", "industrial"], summary: "Hierarchy of controls for work at height.", url: "https://www.legislation.gov.uk/uksi/2005/735" },
  { id: "loler", shortName: "LOLER 1998", fullName: "Lifting Operations and Lifting Equipment Regulations 1998", sectors: ["construction", "industrial"], summary: "Thorough examination, lift plans, competent persons.", url: "https://www.legislation.gov.uk/uksi/1998/2307" },
  { id: "puwer", shortName: "PUWER 1998", fullName: "Provision and Use of Work Equipment Regulations 1998", sectors: ["construction", "industrial", "food_pharma"], summary: "Suitable equipment, guarding, maintenance, inspection.", url: "https://www.legislation.gov.uk/uksi/1998/2306" },
  { id: "coshh", shortName: "COSHH 2002", fullName: "Control of Substances Hazardous to Health Regulations 2002", sectors: ["all"], summary: "SDS, exposure control, health surveillance.", url: "https://www.legislation.gov.uk/uksi/2002/2677" },
  { id: "confined", shortName: "Confined Spaces 1997", fullName: "Confined Spaces Regulations 1997", sectors: ["construction", "utilities"], summary: "Safe systems of work, emergency arrangements.", url: "https://www.legislation.gov.uk/uksi/1997/1713" },
  { id: "noise", shortName: "Noise Regs 2005", fullName: "Control of Noise at Work Regulations 2005", sectors: ["construction", "industrial"], summary: "Exposure action values, hearing protection zones.", url: "https://www.legislation.gov.uk/uksi/2005/1643" },
  { id: "dsear", shortName: "DSEAR 2002", fullName: "Dangerous Substances and Explosive Atmospheres Regulations 2002", sectors: ["industrial", "food_pharma"], summary: "ATEX zones, ignition sources, dust explosions.", url: "https://www.legislation.gov.uk/uksi/2002/2776" },
  { id: "food_safety", shortName: "Food Safety Act 1990", fullName: "Food Safety Act 1990", sectors: ["food_pharma"], summary: "Due diligence, contamination offences — interfaces with contractor hygiene.", url: "https://www.legislation.gov.uk/ukpga/1990/16" },
  { id: "food_hygiene", shortName: "Food Hygiene (England) 2013", fullName: "Food Safety and Hygiene (England) Regulations 2013", sectors: ["food_pharma"], summary: "HACCP, hygiene procedures, contractor controls in food premises.", url: "https://www.legislation.gov.uk/uksi/2013/2996" },
  { id: "manual_handling", shortName: "MHOR 1992", fullName: "Manual Handling Operations Regulations 1992", sectors: ["all"], summary: "Avoid, assess, reduce manual handling risk.", url: "https://www.legislation.gov.uk/uksi/1992/2793" },
  { id: "riddor", shortName: "RIDDOR 2013", fullName: "Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013", sectors: ["all"], summary: "Notifiable incidents, dangerous occurrences, occupational disease.", url: "https://www.legislation.gov.uk/uksi/2013/1471" },
  { id: "electricity", shortName: "EAWR 1989", fullName: "Electricity at Work Regulations 1989", sectors: ["construction", "industrial"], summary: "Systems, work on or near live conductors, competence.", url: "https://www.legislation.gov.uk/uksi/1989/635" },
  { id: "asbestos", shortName: "CAR 2012", fullName: "Control of Asbestos Regulations 2012", sectors: ["construction"], summary: "Survey, management plan, licensed work.", url: "https://www.legislation.gov.uk/uksi/2012/632" },
  { id: "nrswa", shortName: "NRSWA / Streetworks", fullName: "New Roads and Street Works Act 1991", sectors: ["utilities", "highways"], summary: "Street works notices, reinstatement, competence.", url: "https://www.legislation.gov.uk/ukpga/1991/22" },
];

/** @param {string} [sector] */
export function legislationForSector(sector) {
  if (!sector) return UK_LEGISLATION_LIBRARY;
  return UK_LEGISLATION_LIBRARY.filter((l) => l.sectors.includes("all") || l.sectors.includes(sector));
}

/** Seed org register from library */
export function seedLegislationRegister() {
  const now = new Date().toISOString();
  return UK_LEGISLATION_LIBRARY.map((l) => ({
    id: `leg_${l.id}`,
    refId: l.id,
    shortName: l.shortName,
    fullName: l.fullName,
    sectors: l.sectors,
    summary: l.summary,
    url: l.url || "",
    applicable: l.sectors.includes("all") || l.sectors.includes("food_pharma") || l.sectors.includes("construction"),
    lastReviewed: "",
    nextReview: "",
    notes: "",
    createdAt: now,
  }));
}
