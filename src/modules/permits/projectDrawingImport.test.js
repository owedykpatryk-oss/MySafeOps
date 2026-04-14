import { describe, it, expect } from "vitest";
import { parseGeoJsonPoints } from "./projectDrawingImport";

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
