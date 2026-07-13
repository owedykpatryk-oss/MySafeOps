import { describe, expect, it } from "vitest";
import { centroidFromBoundaryRing, geoAnchorFromProject } from "./projectBoundary";

describe("centroidFromBoundaryRing", () => {
  it("averages lat/lng tuples", () => {
    const c = centroidFromBoundaryRing([
      [51.5, -0.1],
      [51.52, -0.1],
      [51.52, -0.08],
      [51.5, -0.08],
    ]);
    expect(c.lat).toBeCloseTo(51.51, 2);
    expect(c.lng).toBeCloseTo(-0.09, 2);
  });

  it("averages { lat, lng } objects", () => {
    const c = centroidFromBoundaryRing([
      { lat: 53.0, lng: -1.0 },
      { lat: 53.02, lng: -1.0 },
    ]);
    expect(c.lat).toBeCloseTo(53.01, 2);
    expect(c.lng).toBeCloseTo(-1.0, 2);
  });
});

describe("geoAnchorFromProject", () => {
  it("uses project lat/lng when no boundary", () => {
    const anchor = geoAnchorFromProject({ lat: "52.4", lng: "-1.9" });
    expect(anchor.lat).toBeCloseTo(52.4, 1);
    expect(anchor.lng).toBeCloseTo(-1.9, 1);
    expect(anchor.spanLat).toBeGreaterThan(0);
  });

  it("derives center and spans from boundary ring", () => {
    const anchor = geoAnchorFromProject({
      boundaryPoints: [
        { lat: 51.5, lng: -0.1 },
        { lat: 51.51, lng: -0.1 },
        { lat: 51.51, lng: -0.09 },
        { lat: 51.5, lng: -0.09 },
      ],
    });
    expect(anchor.lat).toBeCloseTo(51.505, 2);
    expect(anchor.lng).toBeCloseTo(-0.095, 2);
    expect(anchor.spanLat).toBeGreaterThan(0.004);
    expect(anchor.spanLng).toBeGreaterThan(0.005);
  });
});
