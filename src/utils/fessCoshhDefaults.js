/**
 * FESS Group — common food-site COSHH starter substances (org-exclusive seed).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { isFessOrg } from "./fessOrg";

const genId = () => `coshh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export const FESS_COSHH_STARTER_SUBSTANCES = [
  {
    name: "Food-grade silicone sealant",
    manufacturer: "Various",
    riskLevel: "low",
    hazardTypes: ["skin_sensitiser"],
    ppeRequired: ["Nitrile gloves", "Safety glasses"],
    storageLocation: "Van / site store — sealed",
    quantity: "As required",
    unit: "tubes",
  },
  {
    name: "PTFE thread seal tape / lubricant",
    manufacturer: "Various",
    riskLevel: "low",
    hazardTypes: ["irritant"],
    ppeRequired: ["Nitrile gloves"],
    storageLocation: "Van consumables",
    quantity: "As required",
    unit: "rolls",
  },
  {
    name: "Isopropyl alcohol (IPA) — surface wipe",
    manufacturer: "Various",
    riskLevel: "medium",
    hazardTypes: ["flammable", "irritant"],
    ppeRequired: ["Nitrile gloves", "Safety glasses"],
    storageLocation: "Controlled consumables — away from ignition",
    quantity: "500",
    unit: "ml",
  },
  {
    name: "Cutting / grinding fluid (water miscible)",
    manufacturer: "Various",
    riskLevel: "low",
    hazardTypes: ["skin", "eye"],
    ppeRequired: ["Nitrile gloves", "Safety glasses"],
    storageLocation: "Plant room / van",
    quantity: "5",
    unit: "L",
  },
  {
    name: "Stainless pipework cleaner (acidic)",
    manufacturer: "Foodclean / similar",
    riskLevel: "medium",
    hazardTypes: ["corrosive", "irritant"],
    ppeRequired: ["Chemical resistant gloves", "Face shield", "Coveralls"],
    storageLocation: "COSHH cupboard — segregated",
    quantity: "As required",
    unit: "L",
  },
  {
    name: "Spray contact adhesive",
    manufacturer: "Various",
    riskLevel: "medium",
    hazardTypes: ["flammable", "vapour"],
    ppeRequired: ["Nitrile gloves", "Safety glasses", "Dust mask (FFP2)"],
    storageLocation: "Van — upright, cool",
    quantity: "As required",
    unit: "cans",
  },
];

/**
 * Seed starter COSHH rows when register is empty (idempotent for missing names).
 * @returns {{ created: number, total: number }}
 */
export function seedFessCoshhRegister() {
  if (!isFessOrg()) return { created: 0, total: 0 };
  const key = "coshh_register";
  const existing = load(key, []);
  const list = Array.isArray(existing) ? [...existing] : [];
  const byName = new Set(list.map((i) => String(i.name || "").trim().toLowerCase()));
  const now = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const tmpl of FESS_COSHH_STARTER_SUBSTANCES) {
    if (byName.has(tmpl.name.toLowerCase())) continue;
    list.push({
      id: genId(),
      ...tmpl,
      productCode: "",
      sdsUrl: "",
      sdsReviewDate: "",
      assessedBy: "",
      assessedDate: now,
      status: "active",
      notes: "FESS starter substance — attach SDS URL before issue.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    created += 1;
    byName.add(tmpl.name.toLowerCase());
  }

  if (created) save(key, list);
  return { created, total: list.length };
}
