import { getNearestHospital } from "./nearestHospital";

const OSRM_PROXY = "/api/osrm-route";

/**
 * Fetch driving route polyline as Leaflet [lat, lng] tuples.
 * @returns {Promise<{ ring: [number, number][], distance_m: number | null, duration_s: number | null } | null>}
 */
export async function fetchDrivingRouteRing(fromLat, fromLng, toLat, toLng) {
  const res = await fetch(OSRM_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ fromLat, fromLng, toLat, toLng }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!Array.isArray(json?.ring) || json.ring.length < 2) return null;
  return {
    ring: json.ring,
    distance_m: json.distance_m ?? null,
    duration_s: json.duration_s ?? null,
  };
}

function straightLineRing(fromLat, fromLng, toLat, toLng, steps = 12) {
  const ring = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    ring.push([fromLat + (toLat - fromLat) * t, fromLng + (toLng - fromLng) * t]);
  }
  return ring;
}

/**
 * Nearest A&E plus route polyline for map overlay.
 * @param {number} siteLat
 * @param {number} siteLng
 */
export async function resolveHospitalRoute(siteLat, siteLng) {
  const la = Number(siteLat);
  const lo = Number(siteLng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  const hospital = await getNearestHospital(la, lo);
  if (!hospital) return null;

  const routed = await fetchDrivingRouteRing(la, lo, hospital.lat, hospital.lng);
  const ring = routed?.ring || straightLineRing(la, lo, hospital.lat, hospital.lng);

  return {
    hospital,
    ring,
    distance_m: routed?.distance_m ?? hospital.distance_km * 1000,
    duration_s: routed?.duration_s ?? null,
    routed: Boolean(routed?.ring),
  };
}

export function formatRouteDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "";
  const mins = Math.round(s / 60);
  if (mins < 60) return `~${mins} min drive`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `~${h}h ${m}m drive` : `~${h}h drive`;
}
