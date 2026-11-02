/**
 * Same-origin BGS geology proxy client (prod /api/geology, Vite middleware in dev).
 * Prefers DigMap 50k + boreholes; falls back to 625k.
 */

import { appApiUrl } from "./appApiUrl";

const GEOLOGY_PROXY = "/api/geology";

const GB_BOUNDS = { minLat: 49.5, maxLat: 61.2, minLng: -8.8, maxLng: 2.1 };

export function isBgsGreatBritainPoint(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  return (
    Number.isFinite(y) &&
    Number.isFinite(x) &&
    y >= GB_BOUNDS.minLat &&
    y <= GB_BOUNDS.maxLat &&
    x >= GB_BOUNDS.minLng &&
    x <= GB_BOUNDS.maxLng
  );
}

export function bgsResponseMatchesPoint(payload, lat, lng, toleranceDegrees = 0.0001) {
  const responseLat = Number(payload?.lat);
  const responseLng = Number(payload?.lng);
  return (
    Number.isFinite(responseLat) &&
    Number.isFinite(responseLng) &&
    Math.abs(responseLat - Number(lat)) <= toleranceDegrees &&
    Math.abs(responseLng - Number(lng)) <= toleranceDegrees
  );
}

export { BGS_POSTCODE_ACCURACY_WARNING, BGS_50K_DISCLAIMER } from "../../shared/bgsGeologyFetch.mjs";
export { BGS_625K_DISCLAIMER } from "../../shared/bgsGeologyPick.mjs";

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object>}
 */
export async function fetchGeologyAtPoint(lat, lng) {
  if (!isBgsGreatBritainPoint(lat, lng)) {
    throw new Error("BGS Geology 50k covers Great Britain — check the project map pin or postcode");
  }
  const u = new URL(appApiUrl(GEOLOGY_PROXY), typeof window !== "undefined" ? window.location.origin : "http://localhost");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lng", String(lng));
  const r = await fetch(u.toString(), { credentials: "same-origin" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Geology lookup failed");
  }
  const payload = await r.json();
  if (!bgsResponseMatchesPoint(payload, lat, lng)) {
    throw new Error("BGS returned geology for a different point — lookup rejected");
  }
  if (!payload?.bedrock && !payload?.superficial && !payload?.artificial && !payload?.massMovement) {
    throw new Error("BGS returned no mapped geology at the verified point");
  }
  return payload;
}
