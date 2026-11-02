// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { prepareMapImport, mapExport, parseMapCentre, flightAreaFromBoundary } from "./mapTools.js";
import { parseDroneGeometry, geometrySummary } from "./droneGeometry.js";
const shell = [
  [115, -32, 20],
  [115.02, -32, 21],
  [115.02, -31.98, 22],
  [115, -31.98, 23],
  [115, -32, 20],
];
const hole = [
  [115.005, -31.995, 20],
  [115.01, -31.995, 20],
  [115.01, -31.99, 20],
  [115.005, -31.99, 20],
  [115.005, -31.995, 20],
];
const collection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: 'Boundary <A> & "B"', altitudeMode: "absolute" },
      geometry: { type: "Polygon", coordinates: [shell, hole] },
    },
    {
      type: "Feature",
      properties: { name: "Landing" },
      geometry: { type: "Point", coordinates: [115.001, -31.999, 30] },
    },
    {
      type: "Feature",
      properties: { name: "Corridor" },
      geometry: {
        type: "LineString",
        coordinates: [
          [115, -32],
          [115.02, -31.98],
        ],
      },
    },
  ],
};
describe("staged map import and portable export", () => {
  it("copies polygon boundaries with holes without sharing mutable coordinates or replacing existing flight areas", () => {
    const boundary = { type: "FeatureCollection", features: [collection.features[0]] };
    const patch = flightAreaFromBoundary({ boundary });
    expect(patch.flightArea.features[0].geometry.coordinates).toEqual([shell, hole]);
    expect(patch.flightArea).not.toBe(boundary);
    patch.flightArea.features[0].geometry.coordinates[0][0][0] = 116;
    expect(boundary.features[0].geometry.coordinates[0][0][0]).toBe(115);
    expect(() => flightAreaFromBoundary({ boundary, flightArea: boundary })).toThrow(/already exists/);
    expect(() => flightAreaFromBoundary({ boundary: collection })).toThrow(/only polygons/);
    expect(() => flightAreaFromBoundary({})).toThrow();
  });
  it("only replaces the selected destination and keeps polygon holes and altitude", () => {
    const patch = prepareMapImport(collection, [0], "flightArea");
    expect(Object.keys(patch)).toEqual(["flightArea"]);
    expect(patch.flightArea.features[0].geometry.coordinates).toEqual([shell, hole]);
    expect(patch.flightArea.features[0].properties.altitudeMode).toBe("absolute");
    expect(geometrySummary(patch.flightArea).areaM2).toBeGreaterThan(0);
    expect(prepareMapImport(collection, [1], "alternateLanding")).toEqual({ alternateLanding: [115.001, -31.999] });
  });
  it("rejects incompatible, absent, forged or duplicate selections without widening areas", () => {
    expect(() => prepareMapImport(collection, [2], "flightArea")).toThrow(/polygon/i);
    expect(() => prepareMapImport(collection, [0, 1], "landing")).toThrow(/one point/i);
    expect(() => prepareMapImport(collection, [1], "boundary")).toThrow(/point/i);
    for (const ids of [[], [-1], [99], [0.5], [0, 0]])
      expect(() => prepareMapImport(collection, ids, "boundary")).toThrow();
    expect(() => prepareMapImport(collection, [0], "__proto__")).toThrow();
    expect(prepareMapImport(collection, [2], "boundary").boundary.features[0].geometry.type).toBe("LineString");
  });
  it("round trips KML holes, altitude, escaped names and selected layers", () => {
    const mission = {
      title: "Demo <script>",
      revision: 3,
      boundary: prepareMapImport(collection, [0], "boundary").boundary,
      landing: [115, -32],
    };
    const exported = mapExport(mission, "boundary", "kml");
    expect(exported.content).toContain("&lt;A&gt; &amp;");
    expect(exported.content).not.toContain("<script>");
    const parsed = parseDroneGeometry(exported.content, "kml");
    expect(parsed.features[0]).toEqual(mission.boundary.features[0]);
    expect(exported.filename).toMatch(/\.kml$/);
    const geo = JSON.parse(mapExport(mission, "boundary", "geojson").content);
    expect(geo.features).toEqual(mission.boundary.features);
    expect(
      parseDroneGeometry(mapExport(mission, "landing", "kml").content, "kml").features[0].geometry.coordinates
    ).toEqual([115, -32]);
  });
  it("refuses empty or invalid exports and preserves multipart polygons", () => {
    expect(() => mapExport({}, "boundary", "kml")).toThrow(/empty/i);
    expect(() => mapExport({ landing: [400, 30] }, "landing", "kml")).toThrow();
    expect(() => mapExport({ boundary: collection }, "boundary", "html")).toThrow();
    const geometry = { type: "MultiPolygon", coordinates: [[shell, hole]] };
    const boundary = parseDroneGeometry(JSON.stringify(geometry));
    const parsed = parseDroneGeometry(mapExport({ boundary }, "boundary", "kml").content, "kml");
    expect(parsed.features[0].geometry.coordinates).toEqual([shell, hole]);
  });
  it("navigates to explicit latitude/longitude without guessing or moving mission points", () => {
    expect(parseMapCentre("-31.95, 115.86")).toEqual([-31.95, 115.86]);
    for (const input of ["", "115.86, -31.95", "NaN, 1", ",", "12,181", "12,13,14", "85.5,30"])
      expect(() => parseMapCentre(input)).toThrow();
  });
});

describe("KML structure must not silently lose geometry", () => {
  it("retains coincident features with different names or altitude interpretations", () => {
    const point = collection.features[1];
    const source = {
      type: "FeatureCollection",
      features: [
        { ...point, properties: { name: "A", altitudeMode: "absolute" } },
        { ...point, properties: { name: "A", altitudeMode: "relativeToGround" } },
        { ...point, properties: { name: "B", altitudeMode: "absolute" } },
      ],
    };
    const validated = parseDroneGeometry(JSON.stringify(source));
    expect(validated.features).toHaveLength(3);
    const roundTrip = parseDroneGeometry(mapExport({ boundary: validated }, "boundary", "kml").content, "kml");
    expect(roundTrip.features).toHaveLength(3);
  });
  it("reimports a valid KML export containing 101 polygon parts without increasing feature count", () => {
    const features = [50, 50, 1].map((count, group) => ({
      type: "Feature",
      properties: { name: `Group ${group}`, altitudeMode: "absolute" },
      geometry: {
        type: "MultiPolygon",
        coordinates: Array.from({ length: count }, (_, i) => [
          [
            [115 + group + i / 1000, -32],
            [115 + group + i / 1000 + 0.0002, -32],
            [115 + group + i / 1000 + 0.0002, -31.9998],
            [115 + group + i / 1000, -32],
          ],
        ]),
      },
    }));
    const boundary = parseDroneGeometry(JSON.stringify({ type: "FeatureCollection", features }));
    const parsed = parseDroneGeometry(mapExport({ boundary }, "boundary", "kml").content, "kml");
    expect(parsed.features).toHaveLength(3);
    expect(geometrySummary(parsed).polygonCount).toBe(101);
    expect(geometrySummary(parsed).areaM2).toBeCloseTo(geometrySummary(boundary).areaM2, 5);
  });
  it.each([
    "<Point><coordinates>115,-32 116,-33</coordinates></Point>",
    "<Polygon><innerBoundaryIs><LinearRing><coordinates>115,-32 116,-32 116,-31 115,-32</coordinates></LinearRing></innerBoundaryIs></Polygon>",
    "<Model><Location><longitude>115</longitude></Location></Model><Point><coordinates>115,-32</coordinates></Point>",
  ])("rejects malformed or unsupported geometry", (geometry) => {
    expect(() => parseDroneGeometry(`<kml><Placemark>${geometry}</Placemark></kml>`, "kml")).toThrow();
  });
});
