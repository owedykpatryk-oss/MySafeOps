import { describe, expect, it } from "vitest";
import {
  bearingToEnd,
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
