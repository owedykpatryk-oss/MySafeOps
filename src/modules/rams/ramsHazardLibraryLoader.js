/** Lazy-load ~117KB hazard library — only when RAMS builder is open. */
import { filterHazardLibraryForOrg } from "../../utils/fessExclusive";
import { getOrgId } from "../../utils/orgStorage";

let cached = null;
let cachedOrgId = null;
let promise = null;

export function clearRamsHazardLibraryCache() {
  cached = null;
  cachedOrgId = null;
  promise = null;
}

export async function loadRamsHazardLibrary() {
  const orgId = getOrgId();
  if (cached && cachedOrgId === orgId) return cached;
  if (!promise || cachedOrgId !== orgId) {
    promise = import("./ramsAllHazards.js").then((m) => {
      const library = filterHazardLibraryForOrg(m.default, orgId);
      cached = {
        library,
        tradeCategories: m.TRADE_CATEGORIES,
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
      return cached;
    });
  }
  return promise;
}
