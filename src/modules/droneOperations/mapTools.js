import { parseDroneGeometry } from "./droneGeometry.js";

export const MAP_AREAS = {
  boundary: { label: "Survey boundary", color: "#0f766e" },
  flightArea: { label: "Flight area", color: "#2563eb" },
  contingencyArea: { label: "Contingency area", color: "#d97706" },
  safetyArea: { label: "Safety area", color: "#dc2626" },
};
export const MAP_POINTS = {
  takeoff: "Take-off point",
  landing: "Landing point",
  alternateLanding: "Alternate landing point",
};
export const MAP_DESTINATIONS = {
  ...Object.fromEntries(Object.entries(MAP_AREAS).map(([key, item]) => [key, item.label])),
  ...MAP_POINTS,
};
const has = (object, key) => Object.hasOwn(object, key);
export function flightAreaFromBoundary(mission) {
  if (mission.flightArea?.features?.length)
    throw new Error("A flight area already exists. Review it on the map before replacing it.");
  const features = mission.boundary?.features;
  if (!features?.length || features.some((feature) => !["Polygon", "MultiPolygon"].includes(feature.geometry?.type)))
    throw new Error("Use a boundary containing only polygons. Lines and points cannot define a flight area.");
  return { flightArea: parseDroneGeometry(JSON.stringify(mission.boundary)) };
}
const fail = (text) => {
  throw new Error(text);
};
export function prepareMapImport(collection, indices, target) {
  if (!has(MAP_DESTINATIONS, target)) fail("Choose a valid destination layer.");
  if (
    !Array.isArray(indices) ||
    !indices.length ||
    new Set(indices).size !== indices.length ||
    indices.some((i) => !Number.isInteger(i) || i < 0 || i >= (collection?.features?.length || 0))
  )
    fail("Choose at least one valid feature, without duplicates.");
  const selected = parseDroneGeometry(
    JSON.stringify({ type: "FeatureCollection", features: indices.map((i) => collection.features[i]) })
  );
  if (has(MAP_POINTS, target)) {
    if (selected.features.length !== 1 || selected.features[0].geometry.type !== "Point")
      fail("Choose exactly one point for this destination.");
    return { [target]: selected.features[0].geometry.coordinates.slice(0, 2) };
  }
  if (target === "boundary") {
    if (selected.features.some((f) => f.geometry.type === "Point"))
      fail("A survey boundary needs polygons or lines. Assign point features to a point destination separately.");
  } else if (selected.features.some((f) => !["Polygon", "MultiPolygon"].includes(f.geometry.type)))
    fail("This operating area needs polygon features. Lines and points cannot define its extent.");
  return { [target]: selected };
}

export function parseMapCentre(input) {
  const parts = String(input).trim().split(",");
  if (parts.length !== 2 || parts.some((p) => !p.trim()))
    fail("Enter latitude, longitude in decimal degrees, for example -31.95, 115.86.");
  const [lat, lng] = parts.map(Number);
  if (![lat, lng].every(Number.isFinite) || Math.abs(lat) > 85 || Math.abs(lng) > 180)
    fail("Use latitude from -85 to 85 and longitude from -180 to 180.");
  return [lat, lng];
}

const xml = (text) =>
  String(text ?? "")
    .split("")
    .filter((char) => char.charCodeAt(0) >= 32 || "\t\n\r".includes(char))
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
function kmlGeometry(g, mode) {
  const altitude = ["absolute", "relativeToGround", "clampToGround"].includes(mode)
    ? `<altitudeMode>${mode}</altitudeMode>`
    : ["relativeToSeaFloor", "clampToSeaFloor"].includes(mode)
      ? `<gx:altitudeMode>${mode}</gx:altitudeMode>`
      : "";
  const coordinates = (points) => `<coordinates>${points.map((p) => p.join(",")).join(" ")}</coordinates>`;
  if (g.type === "Point") return `<Point>${altitude}${coordinates([g.coordinates])}</Point>`;
  if (g.type === "LineString") return `<LineString>${altitude}${coordinates(g.coordinates)}</LineString>`;
  if (g.type === "MultiPolygon")
    return `<MultiGeometry>${g.coordinates.map((p) => kmlGeometry({ type: "Polygon", coordinates: p }, mode)).join("")}</MultiGeometry>`;
  return `<Polygon>${altitude}${g.coordinates
    .map((ring, i) => {
      const tag = i ? "innerBoundaryIs" : "outerBoundaryIs";
      return `<${tag}><LinearRing>${coordinates(ring)}</LinearRing></${tag}>`;
    })
    .join("")}</Polygon>`;
}
export function mapExport(mission, target, format) {
  if (!has(MAP_DESTINATIONS, target) || !["kml", "geojson"].includes(format))
    fail("Choose a map layer and KML or GeoJSON format.");
  if (!mission[target] || mission[target]?.features?.length === 0)
    fail("This layer is empty. Add an area or point first.");
  const collection = parseDroneGeometry(
    JSON.stringify(
      has(MAP_POINTS, target)
        ? {
            type: "Feature",
            properties: { name: MAP_POINTS[target] },
            geometry: { type: "Point", coordinates: mission[target] },
          }
        : mission[target]
    )
  );
  const title = `${mission.title || "Survey"} — ${MAP_DESTINATIONS[target]} — planning revision ${mission.revision || 1}`;
  const content =
    format === "geojson"
      ? JSON.stringify(collection, null, 2)
      : `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document><name>${xml(title)}</name><description>Planning geometry only. Not a flight plan or permission to fly.</description>${collection.features.map((f) => `<Placemark><name>${xml(f.properties.name)}</name>${kmlGeometry(f.geometry, f.properties.altitudeMode)}</Placemark>`).join("")}</Document></kml>`;
  const filename = `${String(mission.title || "survey")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 70)}-${target}-r${mission.revision || 1}.${format}`;
  return {
    content,
    filename,
    mimeType: format === "kml" ? "application/vnd.google-earth.kml+xml" : "application/geo+json",
  };
}

export function downloadMapLayer(mission, target, format) {
  const file = mapExport(mission, target, format);
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
