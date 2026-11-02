// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseDroneGeometry, importDroneBoundary, geometrySummary } from "./droneGeometry.js";

const polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-1, 51],
      [-0.999, 51],
      [-0.999, 51.001],
      [-1, 51.001],
      [-1, 51],
    ],
  ],
};
describe("drone boundary import", () => {
  it("keeps MultiPolygon areas and WGS84 longitude/latitude", () => {
    const result = parseDroneGeometry(
      JSON.stringify({
        type: "MultiPolygon",
        coordinates: [
          polygon.coordinates,
          [
            [
              [-2, 52],
              [-1.99, 52],
              [-1.99, 52.01],
              [-2, 52.01],
              [-2, 52],
            ],
          ],
        ],
      }),
      "geojson"
    );
    expect(result.features[0].geometry.type).toBe("MultiPolygon");
    expect(geometrySummary(result).areaM2).toBeGreaterThan(1000);
    expect(geometrySummary(result).bounds[0]).toBe(-2);
  });
  it("preserves placemarks, altitude and a line without inventing flight area", () => {
    const result = parseDroneGeometry(
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>Corridor</name><LineString><altitudeMode>absolute</altitudeMode><coordinates>-1,51,32 -1.01,51.01,34</coordinates></LineString></Placemark></kml>',
      "kml"
    );
    expect(result.features[0].properties.name).toBe("Corridor");
    expect(result.features[0].geometry.coordinates[0][2]).toBe(32);
    expect(geometrySummary(result).areaM2).toBe(0);
    expect(geometrySummary(result).hasLines).toBe(true);
  });
  it.each([
    '<!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml/>',
    "<kml><NetworkLink><Link><href>https://example.com</href></Link></NetworkLink></kml>",
    "<kml><broken>",
  ])("rejects unsafe or malformed XML", (text) => {
    expect(() => parseDroneGeometry(text, "kml")).toThrow();
  });
  it("rejects unknown CRS, invalid coordinates and crossing rings", () => {
    expect(() => parseDroneGeometry(JSON.stringify({ ...polygon, crs: { name: "EPSG:27700" } }), "geojson")).toThrow(
      /CRS/
    );
    expect(() => parseDroneGeometry('{"type":"Point","coordinates":[500000,200000]}', "geojson")).toThrow();
    expect(() =>
      parseDroneGeometry(
        JSON.stringify({
          type: "Polygon",
          coordinates: [
            [
              [-1, 51],
              [0, 52],
              [-1, 52],
              [0, 51],
              [-1, 51],
            ],
          ],
        }),
        "geojson"
      )
    ).toThrow();
  });
  it("reads a KMZ without unpacking attachments and rejects traversal", async () => {
    const kml = "<kml><Placemark><Point><coordinates>-5.93,54.60</coordinates></Point></Placemark></kml>";
    const bytes = zipSync({ "doc.kml": strToU8(kml) });
    const file = { name: "belfast.kmz", size: bytes.length, arrayBuffer: async () => bytes.buffer };
    expect((await importDroneBoundary(file)).features[0].geometry.coordinates).toEqual([-5.93, 54.6]);
    const bad = zipSync({ "../doc.kml": strToU8(kml) });
    await expect(importDroneBoundary({ ...file, arrayBuffer: async () => bad.buffer })).rejects.toThrow();
  });
});
