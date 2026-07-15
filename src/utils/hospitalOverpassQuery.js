/**
 * Shared Overpass query for nearest A&E / hospital lookup.
 * Includes ways and relations (most UK hospitals are areas, not nodes).
 */

/** @param {number} lat @param {number} lng @param {number} radiusM */
export function buildHospitalQuery(lat, lng, radiusM) {
  const r = Math.max(500, Math.min(50_000, Math.round(Number(radiusM) || 25_000)));
  const la = Number(lat);
  const lo = Number(lng);
  return `
[out:json][timeout:20];
(
  nwr(around:${r},${la},${lo})["amenity"="hospital"];
  nwr(around:${r},${la},${lo})["healthcare"="hospital"];
  nwr(around:${r},${la},${lo})["emergency"="yes"]["amenity"~"hospital|clinic"];
);
out center tags;
`.trim();
}
