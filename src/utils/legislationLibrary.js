import { UK_LEGISLATION_LIBRARY, seedLegislationRegister as seedUkLegislationRegister } from "./ukLegislationLibrary";
import { AU_LEGISLATION_LIBRARY, seedLegislationRegister as seedAuLegislationRegister } from "./auLegislationLibrary";
import { PL_LEGISLATION_LIBRARY, seedLegislationRegister as seedPlLegislationRegister } from "./plLegislationLibrary";
import { DE_LEGISLATION_LIBRARY, seedLegislationRegister as seedDeLegislationRegister } from "./deLegislationLibrary";
import { AT_LEGISLATION_LIBRARY, seedLegislationRegister as seedAtLegislationRegister } from "./atLegislationLibrary";
import { CH_LEGISLATION_LIBRARY, seedLegislationRegister as seedChLegislationRegister } from "./chLegislationLibrary";

/** @typedef {import("../config/markets").MarketId} MarketId */

/** @param {MarketId} marketId */
export function getLegislationLibraryForMarket(marketId) {
  if (marketId === "au") return AU_LEGISLATION_LIBRARY;
  if (marketId === "pl") return PL_LEGISLATION_LIBRARY;
  if (marketId === "de") return DE_LEGISLATION_LIBRARY;
  if (marketId === "at") return AT_LEGISLATION_LIBRARY;
  if (marketId === "ch") return CH_LEGISLATION_LIBRARY;
  return UK_LEGISLATION_LIBRARY;
}

/** @param {MarketId} marketId */
export function seedLegislationRegisterForMarket(marketId) {
  if (marketId === "au") return seedAuLegislationRegister();
  if (marketId === "pl") return seedPlLegislationRegister();
  if (marketId === "de") return seedDeLegislationRegister();
  if (marketId === "at") return seedAtLegislationRegister();
  if (marketId === "ch") return seedChLegislationRegister();
  return seedUkLegislationRegister();
}
