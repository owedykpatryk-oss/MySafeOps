/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractKmlFromKmzBuffer } from "../../utils/kmzExtract.js";
import {
  parseGeoJsonPoints,
  parseKmlGeometry,
  boundaryFromKmlGeometry,
  describeKmlBoundaryMiss,
} from "./projectDrawingImport";

const FIXTURE_KMZ = join(process.cwd(), "fixtures", "test-job.kmz");

describe("parseKmlGeometry", () => {
  it("parses polygon and line placemarks", () => {
    const kml = `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark><name>Site</name><Polygon><outerBoundaryIs><LinearRing>
    <coordinates>-0.12,51.50,0 -0.11,51.50,0 -0.11,51.51,0 -0.12,51.51,0 -0.12,51.50,0</coordinates>
  </LinearRing></outerBoundaryIs></Polygon></Placemark>
  <Placemark><name>Route</name><LineString>
    <coordinates>-0.12,51.505,0 -0.115,51.508,0</coordinates>
  </LineString></Placemark>
</kml>`;
    const geom = parseKmlGeometry(kml);
    expect(geom.polygons).toHaveLength(1);
    expect(geom.polygons[0].ring.length).toBeGreaterThanOrEqual(4);
    expect(geom.lineStrings).toHaveLength(1);
    const boundary = boundaryFromKmlGeometry(geom);
    expect(boundary.boundaryPoints.length).toBeGreaterThanOrEqual(4);
    expect(boundary.boundaryGeoJson.features).toHaveLength(1);
  });

  it("promotes closed LineString paths to polygons", () => {
    const kml = `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark><name>Loop</name><LineString>
    <coordinates>0,0,0 1,0,0 1,1,0 0,0,0</coordinates>
  </LineString></Placemark>
</kml>`;
    const geom = parseKmlGeometry(kml);
    expect(geom.polygons.length).toBeGreaterThanOrEqual(1);
    expect(boundaryFromKmlGeometry(geom)?.boundaryName).toMatch(/Loop|Closed/i);
  });

  it("parses Google Earth Test job.kmz fixture", () => {
    const buf = readFileSync(FIXTURE_KMZ);
    const extracted = extractKmlFromKmzBuffer(buf);
    expect(extracted?.kmlText).toContain("<Polygon>");
    const geom = parseKmlGeometry(extracted.kmlText);
    expect(geom.polygons.length).toBe(1);
    expect(geom.polygons[0].name).toMatch(/Test job/i);
    expect(geom.polygons[0].ring.length).toBeGreaterThanOrEqual(10);
    const boundary = boundaryFromKmlGeometry(geom, { sourceName: "Test job.kmz" });
    expect(boundary).toBeTruthy();
    expect(boundary.boundaryPoints.length).toBeGreaterThanOrEqual(10);
    expect(boundary.boundaryPoints[0].lat).toBeCloseTo(52.366, 2);
    expect(boundary.boundaryPoints[0].lng).toBeCloseTo(-1.211, 2);
  });

  it("describeKmlBoundaryMiss explains points-only files", () => {
    expect(describeKmlBoundaryMiss({ polygons: [], lineStrings: [], points: [{ lat: 1, lng: 2 }] })).toMatch(/point/i);
  });
});

describe("parseGeoJsonPoints", () => {
  it("parses FeatureCollection Points", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "A", objectType: "zone" },
          geometry: { type: "Point", coordinates: [-0.1, 51.5] },
        },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [1, 2] } },
      ],
    });
    const pts = parseGeoJsonPoints(text);
    expect(pts).toHaveLength(2);
    expect(pts[0].lng).toBeCloseTo(-0.1);
    expect(pts[0].lat).toBeCloseTo(51.5);
    expect(pts[0].name).toBe("A");
    expect(pts[0].type).toBe("zone");
  });

  it("parses single Feature", () => {
    const text = JSON.stringify({
      type: "Feature",
      properties: { label: "L" },
      geometry: { type: "Point", coordinates: [0.2, 52.1] },
    });
    const pts = parseGeoJsonPoints(text);
    expect(pts).toHaveLength(1);
    expect(pts[0].lat).toBeCloseTo(52.1);
    expect(pts[0].label).toBe("L");
  });

  it("returns empty on invalid JSON", () => {
    expect(parseGeoJsonPoints("not json")).toEqual([]);
  });
});
