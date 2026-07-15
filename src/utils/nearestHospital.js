/**
 * Nearest hospital via OpenStreetMap Overpass (proxied) with Nominatim fallback.
 */

const OVERPASS_PROXY_URL = "/api/overpass";
const SEARCH_RADIUS_M = 25000;

/** Prefer emergency facilities by treating them as this many km closer. */
const EMERGENCY_DISTANCE_BONUS_KM = 3;

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

function elementCoords(el) {
  const lat = Number(el?.lat ?? el?.center?.lat);
  const lon = Number(el?.lon ?? el?.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lng: lon };
}

function isEmergencyFacility(tags = {}) {
  return (
    tags.emergency === "yes" ||
    tags["emergency:medical"] === "yes" ||
    /accident|emergency|a\s*&\s*e|casualty/i.test(String(tags.name || ""))
  );
}

function rankScore(distanceKm, tags = {}) {
  let score = distanceKm;
  if (isEmergencyFacility(tags)) score -= EMERGENCY_DISTANCE_BONUS_KM;
  if (tags.amenity === "hospital") score -= 0.5;
  if (tags.amenity === "clinic" && tags.healthcare !== "hospital" && !isEmergencyFacility(tags)) {
    score += 8;
  }
  return score;
}

function pickBestHospital(la, lo, candidates) {
  if (!candidates.length) return null;

  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = `${c.name}|${c.lat.toFixed(4)}|${c.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  const sorted = unique
    .map((c) => {
      const distance_km = haversineKm(la, lo, c.lat, c.lng);
      return { ...c, distance_km, rank: rankScore(distance_km, c.tags || {}) };
    })
    .sort((a, b) => a.rank - b.rank || a.distance_km - b.distance_km);

  const closest = sorted[0];
  if (!closest || closest.distance_km > 80) return null;

  const summaryParts = [closest.emergency ? `${closest.name} (A&E)` : closest.name];
  if (closest.address) summaryParts.push(closest.address);
  summaryParts.push(`(approx. ${closest.distance_km.toFixed(1)} km from site)`);

  return {
    name: closest.name,
    address: closest.address || "",
    distance_km: closest.distance_km,
    summary: summaryParts.join(" — "),
    lat: closest.lat,
    lng: closest.lng,
    directions_url: `https://www.google.com/maps/dir/${la},${lo}/${closest.lat},${closest.lng}`,
    emergency: Boolean(closest.emergency),
    source: closest.source || "overpass",
  };
}

function candidatesFromOverpass(json) {
  const elements = json?.elements || [];
  const withCoords = [];
  for (const el of elements) {
    const coords = elementCoords(el);
    if (!coords) continue;
    const tags = el.tags || {};
    const name = tags.name || tags.official_name || tags["name:en"] || "";
    withCoords.push({
      lat: coords.lat,
      lng: coords.lng,
      name: name || "Hospital",
      address: formatAddress(tags),
      tags,
      emergency: isEmergencyFacility(tags),
      source: "overpass",
    });
  }
  return withCoords;
}

async function fetchViaOverpass(lat, lng) {
  const res = await fetch(OVERPASS_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ lat, lng, radiusM: SEARCH_RADIUS_M }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return candidatesFromOverpass(json);
}

/** Browser Nominatim fallback when Overpass mirrors are down (502). */
async function fetchViaNominatim(lat, lng) {
  const delta = 0.35;
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("amenity", "hospital");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "12");
  u.searchParams.set("addressdetails", "1");
  u.searchParams.set("viewbox", `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
  u.searchParams.set("bounded", "1");
  const res = await fetch(u.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows)) return null;
  return rows
    .map((row) => {
      const la = Number(row.lat);
      const lo = Number(row.lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
      const name = String(row.name || row.display_name || "Hospital").split(",")[0].trim() || "Hospital";
      const a = row.address || {};
      const address = [a.road, a.city || a.town || a.village, a.postcode].filter(Boolean).join(", ");
      return {
        lat: la,
        lng: lo,
        name,
        address,
        tags: { amenity: "hospital", name },
        emergency: /accident|emergency|a\s*&\s*e|casualty/i.test(name),
        source: "nominatim",
      };
    })
    .filter(Boolean);
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ name: string, address: string, distance_km: number, summary: string, lat: number, lng: number, directions_url: string, emergency: boolean, source?: string } | null>}
 */
export async function getNearestHospital(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  let candidates = null;
  try {
    candidates = await fetchViaOverpass(la, lo);
  } catch {
    candidates = null;
  }

  if (!candidates?.length) {
    try {
      candidates = await fetchViaNominatim(la, lo);
    } catch {
      candidates = null;
    }
  }

  return pickBestHospital(la, lo, candidates || []);
}
