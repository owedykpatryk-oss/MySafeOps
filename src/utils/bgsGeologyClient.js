/**
 * Same-origin BGS geology proxy client (prod /api/geology, Vite middleware in dev).
 * Prefers DigMap 50k + boreholes; falls back to 625k.
 */

const GEOLOGY_PROXY = "/api/geology";

export { BGS_POSTCODE_ACCURACY_WARNING, BGS_50K_DISCLAIMER } from "../../shared/bgsGeologyFetch.mjs";
export { BGS_625K_DISCLAIMER } from "../../shared/bgsGeologyPick.mjs";

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object>}
 */
export async function fetchGeologyAtPoint(lat, lng) {
  const u = new URL(GEOLOGY_PROXY, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lng", String(lng));
  const r = await fetch(u.toString(), { credentials: "same-origin" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Geology lookup failed");
  }
  return r.json();
}
