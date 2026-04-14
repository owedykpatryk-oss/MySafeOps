import { drawingObjectLabel } from "./projectDrawingRegistry";
import { planPercentToLatLngAffine } from "./projectDrawingAffine";

/** Default bbox center (illustrative — calibrate in UI for your site). */
export const DEFAULT_GEO_ANCHOR = {
  lat: 51.505,
  lng: -0.09,
  spanLat: 0.012,
  spanLng: 0.016,
};

/**
 * Map plan percentages (0–100, origin top-left) to WGS84 degrees inside the anchor rectangle.
 * x → east, y → south (screen Y down) mapped so plan top ≈ north.
 */
export function planPercentToLatLng(x, y, anchor = DEFAULT_GEO_ANCHOR) {
  const nx = Number(x);
  const ny = Number(y);
  const lng = anchor.lng + (nx / 100) * anchor.spanLng - anchor.spanLng / 2;
  const lat = anchor.lat + (1 - ny / 100) * anchor.spanLat - anchor.spanLat / 2;
  return { lat, lng };
}

/**
 * WGS84 for export: map points use stored coords; plan points use affine (if set) or rectangle anchor.
 * @param {null | { a: number, b: number, c: number, d: number, e: number, f: number }} affine — from 3-point calibration
 */
export function getObjectLatLng(row, anchor = DEFAULT_GEO_ANCHOR, affine = null) {
  if (row && row.placement === "map" && Number.isFinite(row.geoLat) && Number.isFinite(row.geoLng)) {
    return { lat: row.geoLat, lng: row.geoLng };
  }
  if (affine && typeof affine.a === "number" && typeof affine.d === "number") {
    return planPercentToLatLngAffine(row.x, row.y, affine);
  }
  return planPercentToLatLng(row.x, row.y, anchor);
}

export function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * KML 2.2 Placemarks — coordinates are illustrative unless anchor matches real site georeferencing.
 */
export function buildDrawingObjectsKml({
  projectId = "",
  planName = "",
  objects = [],
  anchor = DEFAULT_GEO_ANCHOR,
  affine = null,
  permitRef = "",
}) {
  const docName = escapeXml(`MySafeOps drawings — project ${projectId || "?"}`);
  const metaDesc = escapeXml(
    "Plan points exported with illustrative WGS84 from editor anchor. Adjust anchor lat/lng/spans before relying on positions in Google Earth."
  );

  const placemarks = objects.map((row) => {
    const { lat, lng } = getObjectLatLng(row, anchor, affine);
    const name = escapeXml(drawingObjectLabel(row));
    const src =
      row.placement === "map"
        ? `Map: lat=${Number(row.geoLat).toFixed(6)} lng=${Number(row.geoLng).toFixed(6)}`
        : `Plan: x=${Number(row.x).toFixed(2)}% y=${Number(row.y).toFixed(2)}%`;
    const desc = escapeXml(`${src} | type=${row.type} | planId=${row.planId || ""} | id=${row.id}`);
    return `    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      <ExtendedData>
        <Data name="id"><value>${escapeXml(row.id)}</value></Data>
        <Data name="projectId"><value>${escapeXml(String(row.projectId || ""))}</value></Data>
        <Data name="planId"><value>${escapeXml(String(row.planId || ""))}</value></Data>
        <Data name="placement"><value>${escapeXml(row.placement === "map" ? "map" : "plan")}</value></Data>
        <Data name="objectType"><value>${escapeXml(String(row.type || ""))}</value></Data>
        <Data name="xPercent"><value>${Number(row.x)}</value></Data>
        <Data name="yPercent"><value>${Number(row.y)}</value></Data>
        <Data name="geoLat"><value>${row.geoLat != null ? Number(row.geoLat) : ""}</value></Data>
        <Data name="geoLng"><value>${row.geoLng != null ? Number(row.geoLng) : ""}</value></Data>
        <Data name="permitRef"><value>${escapeXml(String(permitRef || ""))}</value></Data>
      </ExtendedData>
      <Point><coordinates>${lng},${lat},0</coordinates></Point>
    </Placemark>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${docName}</name>
    <description>${metaDesc}</description>
    <Snippet>${escapeXml(planName || "drawing objects")}</Snippet>
${placemarks.join("\n")}
  </Document>
</kml>`;
}

/**
 * GPX 1.1 waypoints — same lat/lng mapping as KML (illustrative anchor).
 */
export function buildDrawingObjectsGpx({
  projectId = "",
  planName = "",
  objects = [],
  anchor = DEFAULT_GEO_ANCHOR,
  affine = null,
  permitRef = "",
}) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const wpts = objects.map((row) => {
    const { lat, lng } = getObjectLatLng(row, anchor, affine);
    const nm = esc(drawingObjectLabel(row));
    const dsc = esc(
      row.placement === "map"
        ? `Map WGS84 | ${row.type} | planId=${row.planId || ""}`
        : `Plan x=${Number(row.x).toFixed(2)}% y=${Number(row.y).toFixed(2)}% | ${row.type} | planId=${row.planId || ""}`
    );
    return `  <wpt lat="${lat}" lon="${lng}">
    <name>${nm}</name>
    <desc>${dsc}</desc>
  </wpt>`;
  });
  const permitBit = permitRef ? ` permitRef: ${permitRef}` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MySafeOps ProjectDrawingEditor" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(`Drawings ${projectId || ""}`)}</name>
    <desc>${esc(`${planName || "Project drawings"} — illustrative WGS84 from plan %; calibrate anchor.${permitBit}`)}</desc>
  </metadata>
${wpts.join("\n")}
</gpx>`;
}
