/** Lazy-load ~117KB hazard library — only when RAMS builder is open. */
let cached = null;
let promise = null;

export async function loadRamsHazardLibrary() {
  if (cached) return cached;
  if (!promise) {
    promise = import("./ramsAllHazards.js").then((m) => {
      cached = {
        library: m.default,
        tradeCategories: m.TRADE_CATEGORIES,
        getByCategory: m.getByCategory,
        searchHazards: m.searchHazards,
      };
      return cached;
    });
  }
  return promise;
}
