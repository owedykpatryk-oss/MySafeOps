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
