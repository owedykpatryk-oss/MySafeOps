import { describe, expect, it } from "vitest";
import { parseCoord, parseLatLng } from "./coordUtils.js";
import {
  isValidUkPostcodeCompact,
  normaliseUkPostcodeCompact,
} from "./postcodeUtils.js";

describe("weather API coordinate parsing", () => {
  it("accepts valid coordinates", () => {
    expect(parseCoord("51.5074", -90, 90)).toBe(51.5074);
    expect(parseCoord("-0.1278", -180, 180)).toBe(-0.1278);
  });

  it("rejects invalid coordinates", () => {
    expect(parseCoord("999", -90, 90)).toBeNull();
    expect(parseCoord("", -180, 180)).toBeNull();
  });

  it("parses lat/lng pairs", () => {
    expect(parseLatLng("51.5", "-0.12")).toEqual({ lat: 51.5, lng: -0.12 });
    expect(parseLatLng("51.5", null)).toBeNull();
  });
});

describe("weather API postcode parsing", () => {
  it("normalises UK postcodes", () => {
    expect(normaliseUkPostcodeCompact("kt22 7sh")).toBe("KT227SH");
    expect(isValidUkPostcodeCompact("KT227SH")).toBe(true);
    expect(isValidUkPostcodeCompact("INVALID")).toBe(false);
  });
});
