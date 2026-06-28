import { describe, expect, it } from "vitest";
import {
  bearingToEnd,
  flipBearing180,
  normalizeBearing,
  orientationAlphaToBearing,
} from "./geoPhotoUtils.js";

describe("geoPhotoUtils", () => {
  it("normalizes bearing to 0–359", () => {
    expect(normalizeBearing(370)).toBe(10);
    expect(normalizeBearing(-10)).toBe(350);
  });

  it("converts device orientation alpha to bearing", () => {
    expect(orientationAlphaToBearing(0)).toBe(0);
    expect(orientationAlphaToBearing(90)).toBe(270);
  });

  it("flips bearing 180°", () => {
    expect(flipBearing180(0)).toBe(180);
    expect(flipBearing180(270)).toBe(90);
  });

  it("computes end point for arrow polyline", () => {
    const end = bearingToEnd(51.5, -0.1, 0);
    expect(end).not.toBeNull();
    expect(end[0]).toBeGreaterThan(51.5);
    expect(Math.abs(end[1] - -0.1)).toBeLessThan(0.00001);
  });
});
