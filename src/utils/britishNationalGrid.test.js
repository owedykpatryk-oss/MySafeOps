import { describe, expect, it } from "vitest";
import {
  gridReferenceFromEastingNorthing,
  osgb36ToEastingNorthing,
  wgs84ToBritishNationalGrid,
} from "./britishNationalGrid.js";

describe("britishNationalGrid", () => {
  // Ordnance Survey worked example (Caister water tower), from "A guide to coordinate systems
  // in Great Britain": OSGB36 52°39'27.2531"N 1°43'04.5177"E and ETRS89 52°39'28.8282"N
  // 1°42'57.8663"E both resolve to E 651409.903, N 313177.270.
  const OS_EXAMPLE = {
    osgb36Lat: 52 + 39 / 60 + 27.2531 / 3600,
    osgb36Lng: 1 + 43 / 60 + 4.5177 / 3600,
    wgs84Lat: 52 + 39 / 60 + 28.8282 / 3600,
    wgs84Lng: 1 + 42 / 60 + 57.8663 / 3600,
    easting: 651409.903,
    northing: 313177.27,
  };

  it("matches the Ordnance Survey worked example for the projection", () => {
    const grid = osgb36ToEastingNorthing(OS_EXAMPLE.osgb36Lat, OS_EXAMPLE.osgb36Lng);
    expect(grid.easting).toBeCloseTo(OS_EXAMPLE.easting, 2);
    expect(grid.northing).toBeCloseTo(OS_EXAMPLE.northing, 2);
  });

  it("converts GPS coordinates to National Grid within Helmert tolerance", () => {
    const grid = wgs84ToBritishNationalGrid(OS_EXAMPLE.wgs84Lat, OS_EXAMPLE.wgs84Lng);
    // Helmert is a ±5 m approximation of the OSTN15 grid shift.
    expect(Math.hypot(grid.easting - OS_EXAMPLE.easting, grid.northing - OS_EXAMPLE.northing)).toBeLessThan(5);
    expect(grid.gridRef.startsWith("TG")).toBe(true);
  });

  it("lands in the expected 100 km square for known cities", () => {
    expect(wgs84ToBritishNationalGrid(51.5074, -0.1278).gridRef.startsWith("TQ")).toBe(true);
    expect(wgs84ToBritishNationalGrid(53.7996, -1.5492).gridRef.startsWith("SE")).toBe(true);
    expect(wgs84ToBritishNationalGrid(55.9533, -3.1883).gridRef.startsWith("NT")).toBe(true);
  });

  it("applies the datum shift rather than projecting GPS coordinates directly", () => {
    const shifted = wgs84ToBritishNationalGrid(53.7996, -1.5492);
    const unshifted = osgb36ToEastingNorthing(53.7996, -1.5492);
    const offset = Math.hypot(shifted.easting - unshifted.easting, shifted.northing - unshifted.northing);
    expect(offset).toBeGreaterThan(50);
    expect(offset).toBeLessThan(200);
  });

  it("formats grid references at the requested precision", () => {
    expect(gridReferenceFromEastingNorthing(530262, 179553)).toBe("TQ 30262 79553");
    expect(gridReferenceFromEastingNorthing(530262, 179553, 4)).toBe("TQ 3026 7955");
    expect(gridReferenceFromEastingNorthing(651409, 313177)).toBe("TG 51409 13177");
  });

  it("returns nothing outside Great Britain or for bad input", () => {
    expect(wgs84ToBritishNationalGrid(48.8584, 2.2945)).toBeNull(); // Eiffel Tower
    expect(wgs84ToBritishNationalGrid(null, null)).toBeNull();
    expect(wgs84ToBritishNationalGrid("x", 0)).toBeNull();
    expect(gridReferenceFromEastingNorthing(-1, 0)).toBe("");
    expect(gridReferenceFromEastingNorthing(NaN, NaN)).toBe("");
  });
});
