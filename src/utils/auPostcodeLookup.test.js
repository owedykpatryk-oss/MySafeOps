import { describe, expect, it } from "vitest";
import {
  extractAuPostcode,
  normaliseAuPostcodeInput,
  resolveAuPostcodeInput,
} from "./auPostcodeLookup";

describe("auPostcodeLookup", () => {
  it("normalises 4-digit AU postcodes", () => {
    expect(normaliseAuPostcodeInput("2000")).toBe("2000");
    expect(normaliseAuPostcodeInput("200")).toBe("");
    expect(normaliseAuPostcodeInput("0200")).toBe("");
  });

  it("extracts postcode from address text", () => {
    expect(extractAuPostcode("Site at 3000 Melbourne")).toBe("3000");
  });

  it("resolves from postcode or embedded text", () => {
    expect(resolveAuPostcodeInput("2000")).toBe("2000");
    expect(resolveAuPostcodeInput("", "NSW 2010")).toBe("2010");
  });
});
