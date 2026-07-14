/**
 * Site boundary helpers — shared by maps and project KML import.
 */

/**
 * @param {object} project
 * @returns {[number, number][] | null} Leaflet-style [lat, lng] ring
 */
export function parseProjectBoundaryRing(project) {
  if (Array.isArray(project?.boundaryPoints) && project.boundaryPoints.length >= 3) {
    const points = project.boundaryPoints
      .map((p) => {
        if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
        if (p && typeof p === "object") return [Number(p.lat), Number(p.lng)];
        return null;
      })
      .filter((x) => x && Number.isFinite(x[0]) && Number.isFinite(x[1]));
    if (points.length >= 3) return points;
  }

  const gj = project?.boundaryGeoJson;
  if (gj?.type === "FeatureCollection" && Array.isArray(gj.features)) {
    for (const f of gj.features) {
      const ring = geoJsonFeatureToLatLngRing(f);
      if (ring) return ring;
    }
  }
  if (gj?.type === "Feature") {
    return geoJsonFeatureToLatLngRing(gj);
  }
  if (gj?.type === "Polygon" && Array.isArray(gj.coordinates?.[0])) {
    return geoJsonFeatureToLatLngRing({ type: "Feature", geometry: gj, properties: {} });
  }

  const coords = project?.boundaryGeoJson?.coordinates;
  if (Array.isArray(coords) && Array.isArray(coords[0])) {
    const ring = coords[0]
      .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[1]), Number(p[0])] : null))
      .filter((x) => x && Number.isFinite(x[0]) && Number.isFinite(x[1]));
    if (ring.length >= 3) return ring;
  }
  return null;
}

function geoJsonFeatureToLatLngRing(feature) {
  const geom = feature?.geometry;
  if (!geom) return null;
  if (geom.type === "Polygon" && Array.isArray(geom.coordinates?.[0])) {
    const ring = geom.coordinates[0]
      .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[1]), Number(p[0])] : null))
      .filter((x) => x && Number.isFinite(x[0]) && Number.isFinite(x[1]));
    return ring.length >= 3 ? ring : null;
  }
  if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates?.[0]?.[0])) {
    const ring = geom.coordinates[0][0]
      .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[1]), Number(p[0])] : null))
      .filter((x) => x && Number.isFinite(x[0]) && Number.isFinite(x[1]));
    return ring.length >= 3 ? ring : null;
  }
  return null;
}

/**
 * @param {{ lat: number, lng: number }[]} ring
 */
export function ringToBoundaryGeoJson(ring, name = "Site boundary") {
  const coords = (ring || [])
    .map((p) => {
      const lat = Number(p.lat ?? p[0]);
      const lng = Number(p.lng ?? p[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
    })
    .filter(Boolean);
  if (coords.length < 3) return null;
  const closed =
    coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name },
        geometry: { type: "Polygon", coordinates: [closed] },
      },
    ],
  };
}

const DEFAULT_GEO_SPAN = { spanLat: 0.012, spanLng: 0.016 };

function clampSpan(v) {
  return Math.min(5, Math.max(0.0005, v));
}

function ringPointLatLng(p) {
  if (Array.isArray(p) && p.length >= 2) return { lat: Number(p[0]), lng: Number(p[1]) };
  if (p && typeof p === "object") return { lat: Number(p.lat), lng: Number(p.lng) };
  return null;
}

/**
 * Centroid of a boundary ring — accepts Leaflet [lat,lng] tuples or { lat, lng } points.
 * @param {Array} ring
 * @returns {{ lat: number, lng: number } | null}
 */
export function centroidFromBoundaryRing(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const p of ring) {
    const pt = ringPointLatLng(p);
    if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;
    sumLat += pt.lat;
    sumLng += pt.lng;
    n += 1;
  }
  if (n === 0) return null;
  return { lat: sumLat / n, lng: sumLng / n };
}

/** London fallback used when no project site coordinates are available. */
export const DEFAULT_DRAWING_GEO_ANCHOR = {
  lat: 51.505,
  lng: -0.09,
  spanLat: DEFAULT_GEO_SPAN.spanLat,
  spanLng: DEFAULT_GEO_SPAN.spanLng,
};

/**
 * True when anchor is still the illustrative London default (not user-calibrated).
 * @param {{ lat?: number, lng?: number } | null | undefined} anchor
 */
export function isDefaultGeoAnchor(anchor) {
  if (!anchor || typeof anchor.lat !== "number" || typeof anchor.lng !== "number") return false;
  return (
    Math.abs(anchor.lat - DEFAULT_DRAWING_GEO_ANCHOR.lat) < 0.0005 &&
    Math.abs(anchor.lng - DEFAULT_DRAWING_GEO_ANCHOR.lng) < 0.0005
  );
}

/**
 * Stable signature for project site fields that affect map centre.
 * @param {object | null | undefined} project
 */
export function projectSiteLocationSignature(project) {
  if (!project) return "";
  const ring = parseProjectBoundaryRing(project);
  const ringKey = ring
    ? ring.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";")
    : "";
  return [
    String(project.id || ""),
    String(project.lat ?? "").trim(),
    String(project.lng ?? "").trim(),
    String(project.postcode ?? "").trim(),
    String(project.address ?? "").trim(),
    String(project.site ?? "").trim(),
    ringKey,
  ].join("|");
}

/**
 * Drawing-editor geo anchor from saved project lat/lng or KML boundary bbox.
 * @param {object | null | undefined} project
 * @returns {{ lat: number, lng: number, spanLat: number, spanLng: number } | null}
 */
export function geoAnchorFromProject(project) {
  const lat = parseFloat(String(project?.lat ?? "").trim());
  const lng = parseFloat(String(project?.lng ?? "").trim());
  const ring = parseProjectBoundaryRing(project);

  if (ring && ring.length >= 3) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    ring.forEach(([plat, plng]) => {
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
      minLat = Math.min(minLat, plat);
      maxLat = Math.max(maxLat, plat);
      minLng = Math.min(minLng, plng);
      maxLng = Math.max(maxLng, plng);
    });
    if (Number.isFinite(minLat) && Number.isFinite(maxLat) && Number.isFinite(minLng) && Number.isFinite(maxLng)) {
      const centerLat = Number.isFinite(lat) ? lat : (minLat + maxLat) / 2;
      const centerLng = Number.isFinite(lng) ? lng : (minLng + maxLng) / 2;
      return {
        lat: centerLat,
        lng: centerLng,
        spanLat: clampSpan(Math.max((maxLat - minLat) * 1.15, 0.004)),
        spanLng: clampSpan(Math.max((maxLng - minLng) * 1.15, 0.005)),
      };
    }
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, ...DEFAULT_GEO_SPAN };
  }

  return null;
}
