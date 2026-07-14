import { planPercentToLatLng } from "./projectDrawingGeo";
import { planPercentToLatLngAffine } from "./projectDrawingAffine";
import { ringToBoundaryGeoJson } from "../../utils/projectBoundary";

/**
 * Convert editor draft ring to Leaflet [lat, lng] tuples for project boundary storage.
 * @param {Array} ring — plan % points or map WGS84 points
 * @param {'plan' | 'map'} placement
 */
export function draftRingToLatLngRing(ring, placement, geoAnchor, affine = null) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const out = [];
  for (const p of ring) {
    if (placement === "map") {
      const lat = Number(p.geoLat ?? p.lat);
      const lng = Number(p.geoLng ?? p.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
      continue;
    }
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    let ll;
    if (affine && typeof affine.a === "number" && typeof affine.d === "number") {
      ll = planPercentToLatLngAffine(x, y, affine);
    } else {
      ll = planPercentToLatLng(x, y, geoAnchor);
    }
    if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) out.push([ll.lat, ll.lng]);
  }
  return out.length >= 3 ? out : null;
}

/**
 * Build project boundary patch from a closed draft ring (same fields as KML import).
 */
export function projectBoundaryFromDraftRing(ring, placement, geoAnchor, affine = null, { name = "Drawn site boundary" } = {}) {
  const latLngRing = draftRingToLatLngRing(ring, placement, geoAnchor, affine);
  if (!latLngRing) return null;
  const boundaryGeoJson = ringToBoundaryGeoJson(latLngRing, name);
  if (!boundaryGeoJson) return null;
  const boundaryPoints = latLngRing.map(([lat, lng]) => ({ lat, lng }));
  return {
    boundaryGeoJson,
    boundaryPoints,
    boundarySource: "pde-draw",
    boundaryName: name,
    boundaryImportedAt: new Date().toISOString(),
  };
}
