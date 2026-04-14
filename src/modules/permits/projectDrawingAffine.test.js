import { describe, it, expect } from "vitest";
import { planPercentToLatLngAffine, solvePlanAffineFromControlPoints } from "./projectDrawingAffine";

describe("projectDrawingAffine", () => {
  it("solvePlanAffineFromControlPoints maps corners and center", () => {
    const aff = solvePlanAffineFromControlPoints([
      { px: 0, py: 0, lat: 51.5, lng: -0.1 },
      { px: 100, py: 0, lat: 51.51, lng: -0.09 },
      { px: 0, py: 100, lat: 51.49, lng: -0.11 },
    ]);
    expect(aff).not.toBeNull();
    const c = planPercentToLatLngAffine(50, 50, aff);
    expect(c.lat).toBeGreaterThan(51.48);
    expect(c.lat).toBeLessThan(51.52);
    expect(c.lng).toBeGreaterThan(-0.12);
    expect(c.lng).toBeLessThan(-0.08);
  });

  it("returns null for collinear control points", () => {
    const aff = solvePlanAffineFromControlPoints([
      { px: 0, py: 0, lat: 51, lng: -0.1 },
      { px: 50, py: 0, lat: 51.01, lng: -0.09 },
      { px: 100, py: 0, lat: 51.02, lng: -0.08 },
    ]);
    expect(aff).toBeNull();
  });
});
