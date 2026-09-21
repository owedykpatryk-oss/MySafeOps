/**
 * The extent a geo-photo covers, traced on the map.
 *
 * A photo says what something looks like but never how much of it there is: "overgrown" reads
 * the same whether it is a verge or half a field. An optional boundary drawn over satellite
 * imagery turns that into a number the report can price, stored on `photo.area` as the drawn
 * points plus the size they enclose so every export quotes the same figure.
 *
 * Rings are stored open — the closing leg back to the first point is implied — in [lat, lng]
 * order to match Leaflet, and flipped only where a format needs lng/lat.
 */

const EARTH_RADIUS_M = 6371008.8;
/** Enough for a hand-traced boundary; stops a stuck finger bloating the saved row. */
export const MAX_AREA_VERTICES = 200;
/** Below this the taps are a stray line, not an area. */
export const MIN_AREA_VERTICES = 3;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Accepts both [lat, lng] pairs and Leaflet's { lat, lng }. */
function normalisePoint(point) {
  const lat = Number(Array.isArray(point) ? point[0] : point?.lat);
  const lng = Number(Array.isArray(point) ? point[1] : point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6];
}

const samePoint = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

/**
 * Drop anything that is not a usable coordinate and leave the ring open.
 * @returns {Array<[number, number]>}
 */
export function normaliseAreaPoints(points) {
  if (!Array.isArray(points)) return [];
  const out = [];
  for (const raw of points) {
    const point = normalisePoint(raw);
    if (!point) continue;
    // A double tap on one spot adds a zero-length leg and a marker nobody can grab.
    if (samePoint(out[out.length - 1], point)) continue;
    out.push(point);
    if (out.length >= MAX_AREA_VERTICES) break;
  }
  if (out.length > 2 && samePoint(out[0], out[out.length - 1])) out.pop();
  return out;
}

function haversineMetres(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Area enclosed by the ring, by spherical excess, so a boundary a kilometre across is not
 * distorted the way a flat-earth shoelace would be.
 * @returns {number} square metres, 0 for anything short of a closed shape
 */
export function polygonAreaSqm(points) {
  const ring = normaliseAreaPoints(points);
  if (ring.length < MIN_AREA_VERTICES) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[(i + 1) % ring.length];
    sum += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Length round the ring, including the closing leg once there are three points. */
export function polygonPerimeterM(points) {
  const ring = normaliseAreaPoints(points);
  if (ring.length < 2) return 0;
  const legs = ring.length < MIN_AREA_VERTICES ? ring.length - 1 : ring.length;
  let total = 0;
  for (let i = 0; i < legs; i += 1) total += haversineMetres(ring[i], ring[(i + 1) % ring.length]);
  return total;
}

/** Mean of the vertices — good enough to hang a label or a report thumbnail on. */
export function polygonCentroid(points) {
  const ring = normaliseAreaPoints(points);
  if (!ring.length) return null;
  const lat = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
  const lng = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  return [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6];
}

/**
 * What the map hands back while someone is still tracing: sizes travel with the points so a
 * half-drawn shape can still show a running total, and nothing downstream recomputes them.
 * @returns {{ points: Array<[number, number]>, sqm: number, perimeterM: number } | null}
 */
export function geoPhotoAreaDraft(points) {
  const ring = normaliseAreaPoints(points);
  if (!ring.length) return null;
  return {
    points: ring,
    sqm: Math.round(polygonAreaSqm(ring) * 10) / 10,
    perimeterM: Math.round(polygonPerimeterM(ring) * 10) / 10,
  };
}

/**
 * The saved shape: a ring of three points or more, or nothing at all. Sizes are recomputed
 * rather than trusted, so an edited or synced row cannot carry a stale figure.
 * @returns {{ points: Array<[number, number]>, sqm: number, perimeterM: number } | null}
 */
export function normaliseGeoPhotoArea(area) {
  const ring = normaliseAreaPoints(Array.isArray(area) ? area : area?.points);
  if (ring.length < MIN_AREA_VERTICES) return null;
  return geoPhotoAreaDraft(ring);
}

/** The extent drawn on a photo, or null. */
export function geoPhotoAreaOf(photo) {
  return normaliseGeoPhotoArea(photo?.area);
}

export function geoPhotoHasArea(photo) {
  return geoPhotoAreaOf(photo) != null;
}

function groupThousands(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Square metres up to a hectare, hectares above it — how UK site work quotes clearance. */
export function formatAreaSqm(sqm) {
  const n = Number(sqm);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 10) return `${n.toFixed(1)} m²`;
  if (n < 10000) return `${groupThousands(Math.round(n))} m²`;
  return `${(n / 10000).toFixed(2)} ha`;
}

export function formatLengthM(metres) {
  const n = Number(metres);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n < 1000 ? `${Math.round(n)} m` : `${(n / 1000).toFixed(2)} km`;
}

/** One value for tables and balloons, e.g. "1,240 m² · 145 m perimeter". */
export function formatGeoPhotoArea(area) {
  const normalised = normaliseGeoPhotoArea(area);
  if (!normalised) return "";
  const size = formatAreaSqm(normalised.sqm);
  const perimeter = formatLengthM(normalised.perimeterM);
  return perimeter ? `${size} · ${perimeter} perimeter` : size;
}

/**
 * What has been traced across a set of photos: the count and the ground it adds up to, for
 * a manager pricing clearance off the register rather than opening every photo.
 * @returns {{ count: number, totalSqm: number, largest: object | null }}
 */
export function summariseGeoPhotoExtents(photos) {
  let totalSqm = 0;
  let count = 0;
  let largest = null;
  let largestSqm = 0;
  for (const photo of photos || []) {
    const area = geoPhotoAreaOf(photo);
    if (!area) continue;
    count += 1;
    totalSqm += area.sqm;
    if (area.sqm > largestSqm) {
      largestSqm = area.sqm;
      largest = photo;
    }
  }
  return { count, totalSqm: Math.round(totalSqm * 10) / 10, largest };
}

/**
 * How far the traced ground sits from where the photo was taken, measured to the nearest
 * corner rather than the middle — a genuinely big extent has its centre far from the camera,
 * but never all of its corners. A boundary drawn on the wrong field looks perfectly
 * reasonable on its own, and this is the only thing that catches it.
 * @returns {number | null} metres from the photo to the nearest corner of the extent
 */
export function geoPhotoAreaOffsetM(photo) {
  const area = geoPhotoAreaOf(photo);
  const lat = Number(photo?.latitude);
  const lng = Number(photo?.longitude);
  if (!area || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const nearest = Math.min(...area.points.map((point) => haversineMetres([lat, lng], point)));
  return Math.round(nearest);
}

/** Past this, the extent is more likely traced somewhere else than genuinely that far off. */
export const AREA_OFFSET_WARN_M = 250;

/** Types where the size of the thing is half the observation, offered up front on capture. */
const AREA_PROMPTS = {
  vegetation: "Trace the overgrown ground so the report can price clearance.",
  obstruction: "Trace the footprint of what is in the way.",
  drainage_water: "Trace the standing water or flooded ground.",
  ground_conditions: "Trace the soft or waterlogged ground.",
  no_access: "Trace the area you could not reach.",
  traffic_management: "Trace the ground the layout takes up.",
  gpr_setup: "Trace the grid you scanned.",
  stockpile: "Trace the footprint of the heap — with the height it becomes a volume.",
  exclusion_zone: "Trace the zone as it was set out on the ground.",
  formation_level: "Trace the formation you checked.",
  soft_strip_progress: "Trace the floor area stripped so far.",
  pollution_incident: "Trace how far the spill spread.",
  waste_flytipping: "Trace the ground the tipping covers.",
  suspected_acm: "Trace the extent of the material, so the removal can be quoted.",
  ecology_feature: "Trace the habitat or buffer zone to be kept clear.",
};

export function geoPhotoTypeWantsArea(type) {
  return Object.prototype.hasOwnProperty.call(AREA_PROMPTS, String(type || ""));
}

/** Why this type would want an extent; a generic line for everything else. */
export function geoPhotoAreaPrompt(type) {
  return AREA_PROMPTS[String(type || "")] || "Trace the ground this photo is about.";
}
