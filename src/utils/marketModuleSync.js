/**
 * Apply market-specific module / RAMS feature defaults when org market is set or changed.
 */
import { resolveMarketId } from "../config/markets";
import {
  getMarketBootstrapExtraHidden,
  getMarketDefaultHiddenFeatures,
  CONSTRUCTION_SLIM_HIDDEN,
} from "../config/marketModules";
import { RAMS_FEATURES } from "./ramsFeatureIds";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

export const HIDDEN_MODULES_UPDATED_EVENT = "mysafeops-hidden-modules-updated";

function parseStringList(raw) {
  return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
}

/**
 * Merge market default hidden features and bootstrap slim menu for the org market.
 * Idempotent per market — re-runs when market changes.
 * @param {import("../config/markets").MarketId} marketId
 * @param {string} [orgId]
 */
export function applyMarketModuleDefaults(marketId, orgId) {
  if (typeof window === "undefined") return marketId;
  const market = resolveMarketId(marketId);
  const raw = loadOrgSettingsRaw(orgId);
  const prevPack = raw.marketModulePackApplied;

  const defaultFeatures = getMarketDefaultHiddenFeatures(market);
  const extraHidden = getMarketBootstrapExtraHidden(market);

  let hiddenModules = parseStringList(raw.hiddenModules);
  let hiddenFeatures = parseStringList(raw.hiddenFeatures);

  if (!raw.hiddenModulesBootstrapped) {
    hiddenModules = [...new Set([...CONSTRUCTION_SLIM_HIDDEN, ...extraHidden])];
  }

  hiddenFeatures = [...new Set([...hiddenFeatures, ...defaultFeatures])];

  // When switching away from UK, drop UK-only surveying hide duplicates; when entering AU, ensure surveying hidden.
  if (market === "au" || market === "pl") {
    if (!hiddenFeatures.includes(RAMS_FEATURES.SURVEYING)) {
      hiddenFeatures.push(RAMS_FEATURES.SURVEYING);
    }
  }

  const next = {
    ...raw,
    hiddenModules,
    hiddenFeatures,
    hiddenModulesBootstrapped: true,
    marketModulePackApplied: market,
  };

  saveOrgSettingsRaw(next, orgId);
  if (prevPack !== market) {
    window.dispatchEvent(new CustomEvent(HIDDEN_MODULES_UPDATED_EVENT, { detail: { orgId, market } }));
  }
  return market;
}
