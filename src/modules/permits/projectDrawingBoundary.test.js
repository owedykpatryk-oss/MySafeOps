import { describe, expect, it } from "vitest";
import { draftRingToLatLngRing, projectBoundaryFromDraftRing } from "./projectDrawingBoundary";
import { DEFAULT_GEO_ANCHOR } from "./projectDrawingGeo";

describe("projectDrawingBoundary", () => {
  it("converts map draft ring to lat/lng tuples", () => {
    const ring = draftRingToLatLngRing(
      [
        { geoLat: 51.5, geoLng: -0.1 },
        { geoLat: 51.51, geoLng: -0.1 },
        { geoLat: 51.51, geoLng: -0.09 },
      ],
      "map",
      DEFAULT_GEO_ANCHOR
    );
    expect(ring).toHaveLength(3);
    expect(ring[0][0]).toBeCloseTo(51.5, 2);
  });

  it("converts plan % draft ring using anchor", () => {
    const ring = draftRingToLatLngRing(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      "plan",
      DEFAULT_GEO_ANCHOR
    );
    expect(ring).toHaveLength(3);
    expect(ring[0][0]).toBeGreaterThan(ring[2][0]);
  });

  it("builds project boundary patch from draft", () => {
    const patch = projectBoundaryFromDraftRing(
      [
        { geoLat: 51.5, geoLng: -0.1 },
        { geoLat: 51.51, geoLng: -0.1 },
        { geoLat: 51.51, geoLng: -0.09 },
      ],
      "map",
      DEFAULT_GEO_ANCHOR
    );
    expect(patch?.boundaryPoints).toHaveLength(3);
    expect(patch?.boundaryGeoJson?.type).toBe("FeatureCollection");
  });
});
