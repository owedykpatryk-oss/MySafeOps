import { unzipSync, strFromU8 } from "fflate";

// Import budgets apply BEFORE ZIP inflation and BEFORE quadratic ring validation.
const MAX_BYTES = 2_000_000;
const MAX_VERTICES = 2000;
const MAX_RING = 500;
const R = 6371008.8;
const rad = (n) => (n * Math.PI) / 180;
const fail = (message) => {
  throw new Error(message);
};
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const orientation = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (p, a, b) =>
  Math.abs(orientation(a, b, p)) < 1e-12 &&
  p[0] >= Math.min(a[0], b[0]) &&
  p[0] <= Math.max(a[0], b[0]) &&
  p[1] >= Math.min(a[1], b[1]) &&
  p[1] <= Math.max(a[1], b[1]);
function intersects(a, b, c, d) {
  return (
    (orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0) ||
    onSegment(a, c, d) ||
    onSegment(b, c, d) ||
    onSegment(c, a, b) ||
    onSegment(d, a, b)
  );
}
function ringArea(ring) {
  return Math.abs(
    (ring.slice(1).reduce((sum, b, i) => {
      const a = ring[i];
      return sum + rad(b[0] - a[0]) * (2 + Math.sin(rad(a[1])) + Math.sin(rad(b[1])));
    }, 0) *
      R *
      R) /
      2
  );
}
function distance(a, b) {
  const h =
    Math.sin(rad(b[1] - a[1]) / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function validateCollection(input) {
  if (input?.crs) fail("Explicit CRS is not supported. Export WGS84 RFC 7946 GeoJSON; do not guess the CRS.");
  const features =
    input?.type === "FeatureCollection"
      ? input.features
      : input?.type === "Feature"
        ? [input]
        : [{ type: "Feature", properties: {}, geometry: input }];
  if (!Array.isArray(features) || !features.length || features.length > 100) fail("Import between 1 and 100 features.");
  let vertices = 0;
  const point = (p) => {
    if (
      !Array.isArray(p) ||
      p.length < 2 ||
      p.length > 3 ||
      p.some((n) => typeof n !== "number" || !Number.isFinite(n)) ||
      Math.abs(p[0]) > 180 ||
      Math.abs(p[1]) > 85
    )
      fail("Invalid WGS84 coordinate. Expected longitude, latitude, optional altitude.");
    if (++vertices > MAX_VERTICES) fail("Geometry exceeds 2,000 vertices. Simplify the source file.");
    return p;
  };
  const line = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) fail("A line needs at least two points.");
    const pts = coords.map(point).filter((p, i, all) => !i || !same(p, all[i - 1]));
    if (pts.length < 2) fail("Degenerate line.");
    return pts;
  };
  const ring = (coords) => {
    const pts = line(coords);
    if (pts.length < 4 || pts.length > MAX_RING || !same(pts[0], pts.at(-1)))
      fail("Polygon rings must be closed with 3–499 distinct vertices.");
    for (let i = 0; i < pts.length - 1; i++)
      for (let j = i + 2; j < pts.length - 1; j++) {
        if (i === 0 && j === pts.length - 2) continue;
        if (intersects(pts[i], pts[i + 1], pts[j], pts[j + 1]))
          fail("Self-intersecting polygon. Repair the boundary in your GIS.");
      }
    if (ringArea(pts) < 0.01) fail("Polygon has no usable area.");
    if (Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])) > 180)
      fail("Antimeridian boundaries require GIS review.");
    return pts;
  };
  const polygon = (coords) => {
    if (!Array.isArray(coords) || !coords.length || coords.length > 20) fail("Invalid polygon rings.");
    const rings = coords.map(ring);
    for (let i = 1; i < rings.length; i++) {
      if (!pointInRing(rings[i][0], rings[0])) fail("Polygon hole is outside its shell.");
      for (let j = 0; j < i; j++) {
        if (j > 0 && (pointInRing(rings[i][0], rings[j]) || pointInRing(rings[j][0], rings[i])))
          fail("Overlapping polygon holes.");
        for (let a = 0; a < rings[i].length - 1; a++)
          for (let b = 0; b < rings[j].length - 1; b++)
            if (intersects(rings[i][a], rings[i][a + 1], rings[j][b], rings[j][b + 1]))
              fail("Intersecting polygon rings.");
      }
    }
    return rings;
  };
  const seen = new Set();
  const result = features
    .map((f) => {
      if (f.crs || f.geometry?.crs) fail("Unsupported CRS.");
      const g = f.geometry;
      if (!g) fail("Missing geometry.");
      let coordinates;
      if (g.type === "Point") coordinates = point(g.coordinates);
      else if (g.type === "LineString") coordinates = line(g.coordinates);
      else if (g.type === "Polygon") coordinates = polygon(g.coordinates);
      else if (
        g.type === "MultiPolygon" &&
        Array.isArray(g.coordinates) &&
        g.coordinates.length &&
        g.coordinates.length <= 50
      )
        coordinates = g.coordinates.map(polygon);
      else fail("Supported geometry: Polygon, MultiPolygon, LineString or Point.");
      return {
        type: "Feature",
        properties: {
          name: String(f.properties?.name || "Imported feature").slice(0, 160),
          altitudeMode: String(f.properties?.altitudeMode || "unspecified").slice(0, 80),
        },
        geometry: { type: g.type, coordinates },
      };
    })
    .filter((f) => {
      const k = JSON.stringify([f.geometry, f.properties]);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return { type: "FeatureCollection", features: result };
}
export function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (onSegment(p, a, b)) return true;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function parseDroneGeometry(text, format = "geojson") {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BYTES) fail("Boundary exceeds 2 MB.");
  if (format === "geojson" || format === "json") return validateCollection(JSON.parse(text));
  if (format !== "kml") fail("Use KML, KMZ or GeoJSON.");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail("DTD and entity declarations are not allowed.");
  const xml = new DOMParser().parseFromString(text, "application/xml");
  const elements = (root, name) => Array.from(root.getElementsByTagNameNS("*", name));
  if (elements(xml, "parsererror").length || xml.documentElement.localName !== "kml") fail("Invalid KML.");
  if (elements(xml, "NetworkLink").length) fail("KML NetworkLinks are not fetched. Export a self-contained boundary.");
  for (const type of ["Model", "Track", "MultiTrack", "GroundOverlay", "ScreenOverlay"])
    if (elements(xml, type).length) fail(`Unsupported KML ${type}. Export only polygon, line and point geometry.`);
  const features = [];
  for (const pm of elements(xml, "Placemark")) {
    const placemarkFeatures = [];
    for (const node of [...elements(pm, "Polygon"), ...elements(pm, "LineString"), ...elements(pm, "Point")]) {
      const readCoords = (n) => {
        const raw = elements(n, "coordinates")[0]?.textContent?.trim();
        if (!raw) fail("Missing KML coordinates.");
        return raw.split(/\s+/).map((p) => p.split(",").map((v) => (v.trim() === "" ? NaN : Number(v))));
      };
      const type = node.localName;
      if (type === "Polygon" && elements(node, "outerBoundaryIs").length !== 1)
        fail("A KML polygon must have exactly one outer boundary.");
      if (type === "Point" && readCoords(node).length !== 1) fail("A KML point must contain exactly one coordinate.");
      const coordinates =
        type === "Polygon"
          ? [...elements(node, "outerBoundaryIs"), ...elements(node, "innerBoundaryIs")].map(readCoords)
          : type === "Point"
            ? readCoords(node)[0]
            : readCoords(node);
      placemarkFeatures.push({
        type: "Feature",
        properties: {
          name: elements(pm, "name")[0]?.textContent || "",
          altitudeMode: elements(node, "altitudeMode")[0]?.textContent || "clampToGround",
        },
        geometry: { type, coordinates },
      });
    }
    // Retain polygon-only multipart placemarks without expanding the feature budget.
    // Mixed types or altitude interpretations must stay separate.
    if (
      placemarkFeatures.length > 1 &&
      placemarkFeatures.length <= 50 &&
      placemarkFeatures.every(
        (feature) =>
          feature.geometry.type === "Polygon" &&
          feature.properties.altitudeMode === placemarkFeatures[0].properties.altitudeMode
      )
    ) {
      features.push({
        ...placemarkFeatures[0],
        geometry: {
          type: "MultiPolygon",
          coordinates: placemarkFeatures.map((feature) => feature.geometry.coordinates),
        },
      });
    } else features.push(...placemarkFeatures);
  }
  return validateCollection({ type: "FeatureCollection", features });
}
export async function importDroneBoundary(file) {
  if (!file || file.size > MAX_BYTES) fail("Boundary file must be at most 2 MB.");
  let ext = file.name.split(".").at(-1).toLowerCase();
  if (ext !== "kmz") return parseDroneGeometry(await file.text(), ext);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) fail("KMZ exceeds 2 MB.");
  let total = 0,
    entries = 0,
    kmlCount = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      if (++entries > 64 || entry.name.split(/[\\/]/).includes("..") || /^[\\/]|^[a-z]:/i.test(entry.name))
        fail("Unsafe KMZ path or too many entries.");
      total += entry.originalSize;
      if (total > MAX_BYTES || entry.originalSize > MAX_BYTES || entry.originalSize / Math.max(1, entry.size) > 100)
        fail("KMZ expanded size or compression ratio exceeds limits.");
      const kml = /\.kml$/i.test(entry.name);
      if (kml && ++kmlCount > 1) fail("KMZ contains several KML documents. Export a single document.");
      return kml;
    },
  });
  const document = Object.values(files)[0];
  if (!document) fail("KMZ contains no KML document.");
  return parseDroneGeometry(strFromU8(document), "kml");
}
export function geometrySummary(collection) {
  const points = [],
    polygons = [];
  let hasLines = false,
    perimeterM = 0,
    areaM2 = 0;
  for (const f of collection?.features || []) {
    const g = f.geometry;
    if (g.type === "Point") points.push(g.coordinates);
    else if (g.type === "LineString") {
      points.push(...g.coordinates);
      hasLines = true;
    } else polygons.push(...(g.type === "Polygon" ? [g.coordinates] : g.coordinates));
  }
  for (const polygon of polygons)
    for (const [i, ring] of polygon.entries()) {
      points.push(...ring);
      areaM2 += (i === 0 ? 1 : -1) * ringArea(ring);
      perimeterM += ring.slice(1).reduce((sum, p, i) => sum + distance(ring[i], p), 0);
    }
  if (!points.length)
    return {
      areaM2: 0,
      perimeterM: 0,
      bounds: null,
      centre: null,
      hasLines: false,
      polygonCount: 0,
      weatherPoints: [],
    };
  const bounds = [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
  const centre = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  const weatherPoints = [centre];
  if (distance([bounds[0], bounds[1]], [bounds[2], bounds[3]]) > 2000)
    weatherPoints.push([bounds[0], bounds[1]], [bounds[2], bounds[3]]);
  return { areaM2, perimeterM, bounds, centre, hasLines, polygonCount: polygons.length, weatherPoints };
}
