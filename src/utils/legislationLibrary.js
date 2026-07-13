import { UK_LEGISLATION_LIBRARY, seedLegislationRegister as seedUkLegislationRegister } from "./ukLegislationLibrary";
import { AU_LEGISLATION_LIBRARY, seedLegislationRegister as seedAuLegislationRegister } from "./auLegislationLibrary";
import { PL_LEGISLATION_LIBRARY, seedLegislationRegister as seedPlLegislationRegister } from "./plLegislationLibrary";

/** @typedef {import("../config/markets").MarketId} MarketId */

/** @param {MarketId} marketId */
export function getLegislationLibraryForMarket(marketId) {
  if (marketId === "au") return AU_LEGISLATION_LIBRARY;
  if (marketId === "pl") return PL_LEGISLATION_LIBRARY;
  return UK_LEGISLATION_LIBRARY;
}

/** @param {MarketId} marketId */
export function seedLegislationRegisterForMarket(marketId) {
  if (marketId === "au") return seedAuLegislationRegister();
  if (marketId === "pl") return seedPlLegislationRegister();
  return seedUkLegislationRegister();
}
