/** Lazy-load ~117KB hazard library — only when RAMS builder is open. */
import { filterHazardLibraryForOrg } from "../../utils/fessExclusive";
import { getOrgMarketId } from "../../utils/orgMarket";
import { getOrgId } from "../../utils/orgStorage";

let cached = null;
let cachedOrgId = null;
let cachedMarketId = null;
let promise = null;

export function clearRamsHazardLibraryCache() {
  cached = null;
  cachedOrgId = null;
  cachedMarketId = null;
  promise = null;
}

/**
 * Market-specific hazards (e.g. the Polish IBWR set) belong only to their own market —
 * a UK builder should never scroll past Polish rows, and a Polish one should get them.
 * @param {object[]} library
 * @param {string} marketId
 */
export function filterHazardLibraryForMarket(library, marketId) {
  const list = Array.isArray(library) ? library : [];
  return list.filter((h) => !h?.market || h.market === marketId);
}

export async function loadRamsHazardLibrary() {
  const orgId = getOrgId();
  const marketId = getOrgMarketId(orgId);
  if (cached && cachedOrgId === orgId && cachedMarketId === marketId) return cached;
  if (!promise || cachedOrgId !== orgId || cachedMarketId !== marketId) {
    promise = import("./ramsAllHazards.js").then((m) => {
      const library = filterHazardLibraryForMarket(filterHazardLibraryForOrg(m.default, orgId), marketId);
      const usedCategories = new Set(library.map((h) => h.category));
      cached = {
        library,
        tradeCategories: m.TRADE_CATEGORIES.filter((c) => usedCategories.has(c)),
        getByCategory: (cat) => library.filter((h) => h.category === cat),
        searchHazards: (q) => {
          const ql = String(q || "").toLowerCase();
          if (!ql) return library;
          return library.filter(
            (h) =>
              h.activity.toLowerCase().includes(ql) ||
              h.hazard.toLowerCase().includes(ql) ||
              h.category.toLowerCase().includes(ql) ||
              String(h.sector || "").toLowerCase().includes(ql)
          );
        },
      };
      cachedOrgId = orgId;
      cachedMarketId = marketId;
      return cached;
    });
  }
  return promise;
}
