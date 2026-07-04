import { describe, expect, it } from "vitest";
import {
  isValidUkPostcodeCompact,
  normaliseUkPostcodeCompact,
} from "./postcodeUtils.js";

describe("postcodeUtils", () => {
  it("normalises compact UK postcodes", () => {
    expect(normaliseUkPostcodeCompact(" kt22 7sh ")).toBe("KT227SH");
    expect(isValidUkPostcodeCompact("KT227SH")).toBe(true);
    expect(isValidUkPostcodeCompact("NOTVALID")).toBe(false);
  });
});
