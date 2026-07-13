import { DEFAULT_MARKET_ID, isValidMarketId, resolveMarketId } from "../config/markets";

const STORAGE_KEY = "mysafeops_market";

/** @returns {import("../config/markets").MarketId | null} */
export function getStoredMarketId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isValidMarketId(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** @param {import("../config/markets").MarketId} marketId */
export function setStoredMarketId(marketId) {
  try {
    localStorage.setItem(STORAGE_KEY, resolveMarketId(marketId));
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns {import("../config/markets").MarketId | null} */
export function getMarketIdFromSearchParams(search = "") {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const m = q.get("market");
  return isValidMarketId(m) ? m : null;
}

/**
 * Preferred market for signup / billing hints: URL param → localStorage → default.
 * @param {string} [search]
 */
export function resolvePreferredMarketId(search = typeof window !== "undefined" ? window.location.search : "") {
  return getMarketIdFromSearchParams(search) ?? getStoredMarketId() ?? DEFAULT_MARKET_ID;
}
