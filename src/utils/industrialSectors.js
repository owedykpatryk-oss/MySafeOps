/**
 * Industrial / food–pharma sector flags for org-scoped features (FESS-style sites + generic contractors).
 * Stored on `mysafeops_org_settings` as `industrySectors: string[]`.
 */

const ORG_KEY = "mysafeops_org_settings";

export const INDUSTRY_SECTOR_OPTIONS = [
  { id: "construction", label: "Construction (general)" },
  { id: "food_beverage", label: "Food & beverage" },
  { id: "pet_food", label: "Pet food" },
  { id: "pharma", label: "Pharmaceuticals" },
  { id: "petrochem", label: "Petrochemical" },
  { id: "dairy", label: "Dairy" },
  { id: "brewing", label: "Brewing & distilling" },
];

const FOODISH = new Set(["food_beverage", "pet_food", "dairy", "brewing"]);

/** @returns {string[]} */
export function readIndustrySectorsFromStorage() {
  try {
    const raw = localStorage.getItem(ORG_KEY);
    if (!raw) return ["construction"];
    const o = JSON.parse(raw);
    const list = o?.industrySectors;
    if (!Array.isArray(list) || list.length === 0) return ["construction"];
    return list.map(String);
  } catch {
    return ["construction"];
  }
}

export function orgHasFoodIndustrialPack() {
  const s = readIndustrySectorsFromStorage();
  return s.some((id) => FOODISH.has(id) || id === "petrochem");
}

export function orgHasPharmaPack() {
  return readIndustrySectorsFromStorage().includes("pharma");
}

export function orgShowsIndustrialMoreModules() {
  const s = readIndustrySectorsFromStorage();
  return s.some((id) => id !== "construction");
}

/**
 * Active allergen changeover windows for banner display.
 * @param {Array<{ startAt: string, endAt: string, siteLabel?: string, fromAllergen?: string, toAllergen?: string, label?: string }>} windows
 * @param {number} nowMs
 */
export function activeAllergenWindows(windows, nowMs = Date.now()) {
  if (!Array.isArray(windows)) return [];
  return windows.filter((w) => {
    const a = Date.parse(w.startAt);
    const b = Date.parse(w.endAt);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return nowMs >= a && nowMs <= b;
  });
}
