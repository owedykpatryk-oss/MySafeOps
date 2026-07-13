import { resolveMarketId, getMarket } from "../config/markets";
import { getOrgId } from "./orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { getStoredMarketId, setStoredMarketId } from "./marketPref";
import { applyMarketModuleDefaults } from "./marketModuleSync";

/** @typedef {import("../config/markets").MarketId} MarketId */

/** @returns {MarketId} */
export function getOrgMarketId(orgId = getOrgId()) {
  const settings = loadOrgSettingsRaw(orgId);
  const fromSettings = settings?.market;
  if (fromSettings === "au" || fromSettings === "uk" || fromSettings === "pl") return fromSettings;
  const stored = getStoredMarketId();
  if (stored) return stored;
  return "uk";
}

/**
 * Persist market on org settings (admin-configurable) and local preference.
 * @param {MarketId} marketId
 * @param {string} [orgId]
 */
export function setOrgMarketId(marketId, orgId = getOrgId()) {
  const market = resolveMarketId(marketId);
  const settings = loadOrgSettingsRaw(orgId);
  const next = {
    ...settings,
    market,
    locale: getMarket(market).locale,
  };
  saveOrgSettingsRaw(next, orgId, new Date().toISOString());
  setStoredMarketId(market);
  applyMarketModuleDefaults(market, orgId);
  return market;
}

/**
 * On first cloud sign-in, copy market from auth metadata / landing preference into org settings.
 * @param {import("@supabase/supabase-js").SupabaseClient | null | undefined} supabase
 */
export async function syncOrgMarketFromAuth(supabase) {
  const orgId = getOrgId();
  const settings = loadOrgSettingsRaw(orgId);
  if (settings.market === "au" || settings.market === "uk" || settings.market === "pl") {
    setStoredMarketId(settings.market);
    return settings.market;
  }

  let fromMeta = null;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      const m = data?.user?.user_metadata?.market;
      if (m === "au" || m === "uk" || m === "pl") fromMeta = m;
    } catch {
      /* ignore */
    }
  }

  const market = resolveMarketId(fromMeta ?? getStoredMarketId() ?? "uk");
  setOrgMarketId(market, orgId);
  return market;
}

/** @param {MarketId} marketId */
export function isAuOrg(marketId = getOrgMarketId()) {
  return marketId === "au";
}
