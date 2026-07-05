/**
 * Nearest hospital via OpenStreetMap Overpass (no API key).
 * Adapted from processing-tracker lib/rams/nearestHospital.ts
 */

const OVERPASS_PROXY_URL = "/api/overpass";
const SEARCH_RADIUS_M = 25000;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatAddress(tags = {}) {
  if (tags["addr:full"]) return tags["addr:full"];
  const parts = [];
  if (tags["addr:housenumber"] || tags["addr:street"]) {
    parts.push([tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "));
  }
  if (tags["addr:city"]) parts.push(tags["addr:city"]);
  if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);
  return parts.filter(Boolean).join(", ");
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ name: string, address: string, distance_km: number, summary: string, lat: number, lng: number, directions_url: string } | null>}
 */
export async function getNearestHospital(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  const res = await fetch(OVERPASS_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ lat: la, lng: lo, radiusM: SEARCH_RADIUS_M }),
  });
  if (!res.ok) return null;

  const json = await res.json();
  const elements = json?.elements || [];
  const withCoords = [];

  for (const el of elements) {
    if (el.type !== "node" || el.lat == null || el.lon == null) continue;
    const tags = el.tags || {};
    withCoords.push({
      lat: el.lat,
      lng: el.lon,
      name: tags.name || tags.official_name || "Hospital",
      address: formatAddress(tags),
    });
  }

  if (!withCoords.length) return null;

  const sorted = withCoords
    .map((c) => ({ ...c, distance_km: haversineKm(la, lo, c.lat, c.lng) }))
    .sort((a, b) => a.distance_km - b.distance_km);

  const closest = sorted[0];
  const summaryParts = [closest.name];
  if (closest.address) summaryParts.push(closest.address);
  summaryParts.push(`(approx. ${closest.distance_km.toFixed(1)} km from site)`);

  return {
    name: closest.name,
    address: closest.address,
    distance_km: closest.distance_km,
    summary: summaryParts.join(" — "),
    lat: closest.lat,
    lng: closest.lng,
    directions_url: `https://www.google.com/maps/dir/${la},${lo}/${closest.lat},${closest.lng}`,
  };
}
