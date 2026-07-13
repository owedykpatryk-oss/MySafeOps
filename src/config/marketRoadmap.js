/** @typedef {import("./markets").MarketId} MarketId */

/** @typedef {"live" | "beta" | "planned"} MarketRolloutStatus */

/**
 * Expansion priority — ROI score is relative (UK = 100 baseline).
 * `live` / `beta` must exist in MARKETS; `planned` is roadmap only.
 * @type {Array<{
 *   id: MarketId | "nz" | "ie" | "ca" | "za" | "sg";
 *   status: MarketRolloutStatus;
 *   roi: number;
 *   reuseFrom?: MarketId;
 *   note: string;
 * }>}
 */
export const MARKET_ROADMAP = [
  { id: "uk", status: "live", roi: 100, note: "Home market — CDM, RIDDOR, PAS128" },
  { id: "au", status: "live", roi: 80, note: "SWMS, WHS plan, model WHS laws" },
  { id: "pl", status: "beta", roi: 70, reuseFrom: "uk", note: "BHP / IOR, PIP reporting, pl-PL UI, PLN Stripe live" },
  { id: "ie", status: "planned", roi: 95, reuseFrom: "uk", note: "Safety Statement — fork UK pack" },
  { id: "nz", status: "planned", roi: 90, reuseFrom: "au", note: "SWMS — fork AU pack" },
  { id: "ca", status: "planned", roi: 75, reuseFrom: "uk", note: "Provincial OH&S — JHA/COR" },
  { id: "za", status: "planned", roi: 55, reuseFrom: "uk", note: "English RAMS culture, lower ARPU" },
  { id: "sg", status: "planned", roi: 50, reuseFrom: "au", note: "WSH Act, enterprise ACV" },
];

/** @param {MarketRolloutStatus} status */
export function marketsByRolloutStatus(status) {
  return MARKET_ROADMAP.filter((m) => m.status === status);
}

/** @param {string} id */
export function roadmapEntryFor(id) {
  return MARKET_ROADMAP.find((m) => m.id === id) ?? null;
}
