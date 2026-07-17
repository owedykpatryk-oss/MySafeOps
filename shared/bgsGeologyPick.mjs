/**
 * Pick the BGS GeoJSON feature that best matches a query point.
 * Prefer polygon containment; otherwise nearest ring vertex / bbox centre.
 * 1:625k polygons are huge — features[0] from bbox is often the wrong neighbour.
 */

/** Ray-cast point-in-ring (lng/lat). ring = [[lng,lat], ...] */
export function pointInRing(lng, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) continue;
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function geometryContainsPoint(geometry, lng, lat) {
  if (!geometry || !geometry.type) return false;
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates || [];
    if (!rings[0] || !pointInRing(lng, lat, rings[0])) return false;
    for (let h = 1; h < rings.length; h++) {
      if (pointInRing(lng, lat, rings[h])) return false;
    }
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || []).some((poly) => {
      const rings = poly || [];
      if (!rings[0] || !pointInRing(lng, lat, rings[0])) return false;
      for (let h = 1; h < rings.length; h++) {
        if (pointInRing(lng, lat, rings[h])) return false;
      }
      return true;
    });
  }
  return false;
}

function firstCoord(geometry) {
  const walk = (node) => {
    if (!Array.isArray(node) || !node.length) return null;
    if (typeof node[0] === "number" && typeof node[1] === "number") return [node[0], node[1]];
    for (const child of node) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(geometry?.coordinates);
}

function dist2(aLng, aLat, bLng, bLat) {
  const dx = aLng - bLng;
  const dy = aLat - bLat;
  return dx * dx + dy * dy;
}

/**
 * @param {object[]} features GeoJSON features
 * @param {number} lng
 * @param {number} lat
 */
export function pickBestGeologyFeature(features, lng, lat) {
  const list = (features || []).filter((f) => f && f.properties);
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  const containing = list.filter((f) => geometryContainsPoint(f.geometry, lng, lat));
  if (containing.length === 1) return containing[0];
  if (containing.length > 1) {
    // Prefer first containing — at 625k overlap is rare; keep stable order
    return containing[0];
  }

  let best = list[0];
  let bestD = Infinity;
  for (const f of list) {
    const c = firstCoord(f.geometry);
    if (!c) continue;
    const d = dist2(c[0], c[1], lng, lat);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export const BGS_625K_DISCLAIMER =
  "BGS 1:625,000 digital geology is a regional overview only (Open Government Licence). It is not a site investigation, trial-pit soil log or geotechnical design description — local made ground, fill thickness and moisture often differ from the map.";
