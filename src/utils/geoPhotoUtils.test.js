import { describe, expect, it } from "vitest";
import {
  bearingArrowHead,
  bearingToEnd,
  destinationPoint,
  DIRECTION_LENGTH_M,
  flipBearing180,
  GPS_GOOD_ACCURACY_M,
  isCoarseGpsAccuracy,
  normalisePhotoExifLocation,
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

  it("keeps arrow length in metres regardless of direction", () => {
    // 30 m due north and 30 m due east must cover the same ground distance at UK latitudes.
    const north = destinationPoint(53.8, -1.55, 0, 30);
    const east = destinationPoint(53.8, -1.55, 90, 30);
    const metresNorth = (north[0] - 53.8) * 111320;
    const metresEast = (east[1] - -1.55) * 111320 * Math.cos((53.8 * Math.PI) / 180);
    expect(metresNorth).toBeCloseTo(30, 0);
    expect(metresEast).toBeCloseTo(30, 0);
    expect(east[0]).toBeCloseTo(53.8, 6);
  });

  it("builds an arrow head that points along the bearing", () => {
    const head = bearingArrowHead(53.8, -1.55, 90);
    const tip = bearingToEnd(53.8, -1.55, 90);
    expect(head.tip).toEqual(tip);
    // Barbs sit behind the tip (west of it) and straddle the centre line.
    expect(head.left[1]).toBeLessThan(head.tip[1]);
    expect(head.right[1]).toBeLessThan(head.tip[1]);
    expect(head.left[0]).toBeGreaterThan(head.tip[0]);
    expect(head.right[0]).toBeLessThan(head.tip[0]);
    expect(head.tip[0] - head.left[0]).toBeCloseTo(head.right[0] - head.tip[0], 6);
  });

  it("has no direction geometry without a bearing", () => {
    expect(bearingArrowHead(53.8, -1.55, null)).toBeNull();
    expect(bearingToEnd(53.8, -1.55, null)).toBeNull();
    expect(destinationPoint(null, null, 90, DIRECTION_LENGTH_M)).toBeNull();
  });

  it("flags GPS fixes too coarse for survey evidence", () => {
    expect(isCoarseGpsAccuracy(GPS_GOOD_ACCURACY_M + 1)).toBe(true);
    expect(isCoarseGpsAccuracy(GPS_GOOD_ACCURACY_M)).toBe(false);
    expect(isCoarseGpsAccuracy(4)).toBe(false);
    expect(isCoarseGpsAccuracy(null)).toBe(false);
    expect(isCoarseGpsAccuracy("nonsense")).toBe(false);
  });

  it("reads EXIF coordinates from either tag naming", () => {
    expect(normalisePhotoExifLocation({ latitude: 53.7996123456, longitude: -1.5491987654 })).toEqual({
      latitude: 53.799612,
      longitude: -1.549199,
      altitude: null,
    });
    expect(normalisePhotoExifLocation({ GPSLatitude: 51.5, GPSLongitude: -0.1, GPSAltitude: 42.26 })).toEqual({
      latitude: 51.5,
      longitude: -0.1,
      altitude: 42.3,
    });
  });

  it("converts raw degrees/minutes/seconds EXIF triples with hemisphere refs", () => {
    expect(
      normalisePhotoExifLocation({
        GPSLatitude: [53, 47, 58.6],
        GPSLatitudeRef: "N",
        GPSLongitude: [1, 32, 57.1],
        GPSLongitudeRef: "W",
      })
    ).toEqual({ latitude: 53.799611, longitude: -1.549194, altitude: null });
  });

  it("rejects missing, out-of-range and null-island EXIF coordinates", () => {
    expect(normalisePhotoExifLocation(null)).toBeNull();
    expect(normalisePhotoExifLocation({})).toBeNull();
    expect(normalisePhotoExifLocation({ latitude: 0, longitude: 0 })).toBeNull();
    expect(normalisePhotoExifLocation({ latitude: 91, longitude: 0 })).toBeNull();
    expect(normalisePhotoExifLocation({ latitude: 51.5, longitude: 181 })).toBeNull();
  });
});
