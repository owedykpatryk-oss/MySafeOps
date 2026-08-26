import { getOrgMarketId } from "./orgMarket";
import { getMarket } from "../config/markets";
import { getMarketLabelPack } from "../config/marketLabelPacks";
import { getRamsLongLabel, getRamsShortLabel } from "./marketLabels";

/** @param {import("../config/markets").MarketId} [marketId] */
export function getRamsBuilderTitle(marketId = getOrgMarketId()) {
  return getMarketLabelPack(marketId).ramsBuilderTitle;
}

/** @param {import("../config/markets").MarketId} [marketId] */
export function getRamsModuleLabel(marketId = getOrgMarketId()) {
  return getRamsShortLabel(marketId);
}

/** @param {import("../config/markets").MarketId} [marketId] */
export function getRamsDocumentLabel(marketId = getOrgMarketId()) {
  return getRamsLongLabel(marketId);
}

/** @param {import("../config/markets").MarketId} [marketId] */
export function getLeaveRamsBuilderConfirm(marketId = getOrgMarketId()) {
  const label = getRamsShortLabel(marketId);
  if (marketId === "pl") {
    return `Opuścić kreator ${label}? Niezapisane zmiany zostaną utracone.`;
  }
  if (marketId === "de" || marketId === "at" || marketId === "ch") {
    return `${label}-Generator verlassen? Nicht gespeicherte Änderungen gehen verloren.`;
  }
  return `Leave ${label} builder? Unsaved changes will be lost.`;
}

/** Labels for RAMS/SWMS/IBWR print & PDF output. */
export function getRamsPrintLabels(marketId = getOrgMarketId()) {
  const pack = getMarketLabelPack(marketId);
  const market = getMarket(marketId);
  const scopeByMarket = {
    au: "Detailed SWMS pack generated for field execution and WHS compliance review.",
    pl: "Pakiet IBWR wygenerowany do pracy w terenie i weryfikacji BHP na budowie.",
    de: "GBU-Paket für die Baustelle und Arbeitsschutz-Überprüfung.",
    at: "GBU-Paket für die Baustelle und Arbeitsschutz-Überprüfung.",
    ch: "Gefährdungsermittlungs-Paket für die Baustelle und Arbeitssicherheits-Überprüfung.",
    uk: "Detailed RAMS pack generated for field execution and compliance review.",
  };
  const emergencyByMarket = {
    au: "Dial 000 in an emergency",
    pl: "W nagłych wypadkach dzwoń 112",
    de: "Im Notfall 112 anrufen",
    at: "Im Notfall 112 anrufen",
    ch: "Im Notfall 112 / 144 anrufen",
    uk: "Dial 999 in an emergency",
  };
  return {
    docShort: pack.ramsShort,
    docLong: pack.ramsLong,
    defaultTitle: pack.ramsLong,
    defaultScope: scopeByMarket[marketId] ?? scopeByMarket.uk,
    hospitalHeading: pack.hospitalHeading,
    emergencyLine: emergencyByMarket[marketId] ?? emergencyByMarket.uk,
    locale: market.locale,
  };
}
