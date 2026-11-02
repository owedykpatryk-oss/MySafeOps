/** Desk check: mapped open water near the survey point. Far water is omitted. */

export const FRESH_WATER_M = 100;
export const SALT_WATER_M = 300;
export const WATER_QUERY_RADIUS_M = 320;

const FRESH_WATERWAY = new Set(["river", "stream", "canal", "drain", "ditch"]);
const FRESH_WATER = new Set(["river", "canal", "lake", "reservoir", "pond", "stream"]);

export function buildWaterOverpassQuery(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  const r = WATER_QUERY_RADIUS_M;
  return `
[out:json][timeout:20];
(
  way(around:${r},${la},${lo})["natural"="water"];
  way(around:${r},${la},${lo})["natural"="coastline"];
  way(around:${r},${la},${lo})["natural"="bay"];
  way(around:${r},${la},${lo})["natural"="strait"];
  way(around:${r},${la},${lo})["waterway"~"^(river|stream|canal|drain|ditch|tidal_channel)$"];
  way(around:${r},${la},${lo})["water"~"^(river|canal|lake|reservoir|pond)$"];
  way(around:${r},${la},${lo})["tidal"="yes"];
);
out geom tags;
`.trim();
}

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const p1 = (Number(lat1) * Math.PI) / 180;
  const p2 = (Number(lat2) * Math.PI) / 180;
  const dp = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dl = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pointToSegmentM(lat, lng, a, b) {
  const midLat = (Number(a.lat) + Number(b.lat)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180) * 111320;
  const ky = 110540;
  const ax = (Number(a.lon) - lng) * kx;
  const ay = (Number(a.lat) - lat) * ky;
  const bx = (Number(b.lon) - lng) * kx;
  const by = (Number(b.lat) - lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanceToGeometryM(lat, lng, geometry) {
  const pts = Array.isArray(geometry) ? geometry.filter((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lon))) : [];
  if (!pts.length) return Infinity;
  let best = Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    best = Math.min(best, haversineM(lat, lng, pts[i].lat, pts[i].lon));
    if (i > 0) best = Math.min(best, pointToSegmentM(lat, lng, pts[i - 1], pts[i]));
  }
  return best;
}

/** Salt or tidal water takes priority over a fresh-water tag on the same feature. */
export function classifyWaterTags(tags = {}) {
  const natural = String(tags.natural || "");
  const waterway = String(tags.waterway || "");
  const water = String(tags.water || "");
  const tidal = String(tags.tidal || "") === "yes" || waterway === "tidal_channel";
  const coastal = natural === "coastline" || natural === "bay" || natural === "strait" || tags.place === "sea" || tags.salt === "yes";
  if (tidal || coastal) return "salt";
  if (natural === "water" || FRESH_WATERWAY.has(waterway) || FRESH_WATER.has(water)) return "fresh";
  return "";
}

function kindLabel(tags, salinity) {
  if (salinity === "salt") {
    if (tags.natural === "coastline" || tags.natural === "bay" || tags.natural === "strait") return "coastline";
    if (tags.waterway === "tidal_channel" || tags.tidal === "yes") return "tidal water";
    return "tidal or coastal water";
  }
  return tags.waterway || tags.water || tags.natural || "open water";
}

export function summariseWaterElements(lat, lng, elements = []) {
  const nearest = { fresh: null, salt: null };
  for (const el of elements) {
    const salinity = classifyWaterTags(el?.tags || {});
    if (!salinity) continue;
    const geometry = el.geometry || (Number.isFinite(Number(el.lat)) ? [{ lat: el.lat, lon: el.lon }] : []);
    const distanceM = distanceToGeometryM(lat, lng, geometry);
    const limit = salinity === "salt" ? SALT_WATER_M : FRESH_WATER_M;
    if (!Number.isFinite(distanceM) || distanceM > limit) continue;
    const hit = {
      distanceM: Math.round(distanceM),
      kind: kindLabel(el.tags || {}, salinity),
      name: String(el.tags?.name || "").trim(),
    };
    if (!nearest[salinity] || hit.distanceM < nearest[salinity].distanceM) nearest[salinity] = hit;
  }
  return nearest;
}

export function waterImpactSentence(summary, retrievedAt = "") {
  if (!summary?.fresh && !summary?.salt) return "";
  const when = retrievedAt ? ` Retrieved ${retrievedAt.slice(0, 10)}.` : "";
  const parts = [];
  if (summary.fresh) {
    const name = summary.fresh.name ? ` (${summary.fresh.name})` : "";
    parts.push(
      `OpenStreetMap records ${summary.fresh.kind}${name} about ${summary.fresh.distanceM} m from the survey point.${when} Wet ground beside open water can weaken antenna coupling and reduce penetration. This is a desk check of mapped water, not a measurement of soil moisture. Source: OpenStreetMap.`
    );
  }
  if (summary.salt) {
    const name = summary.salt.name ? ` (${summary.salt.name})` : "";
    parts.push(
      `OpenStreetMap records ${summary.salt.kind}${name} about ${summary.salt.distanceM} m from the survey point.${when} Salt or brackish water near the antenna can raise ground conductivity and cut GPR penetration. Proximity is not proof that the surveyed ground is saline. Source: OpenStreetMap.`
    );
  }
  return parts.join("\n\n");
}

const WATER_PARAGRAPH = /\n*OpenStreetMap records[\s\S]*?Source: OpenStreetMap\./g;

export function mergeWaterImpact(existing, summary, retrievedAt) {
  const kept = String(existing || "").replace(WATER_PARAGRAPH, "").trim();
  const sentence = waterImpactSentence(summary, retrievedAt);
  return [kept, sentence].filter(Boolean).join("\n\n");
}
