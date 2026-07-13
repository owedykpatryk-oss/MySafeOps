import { describe, expect, it } from "vitest";
import { normalizePlPostcode, resolvePlPostcodeInput } from "./plPostcodeLookup";

describe("plPostcodeLookup", () => {
  it("normalises Polish postcodes", () => {
    expect(normalizePlPostcode("00-001")).toBe("00-001");
    expect(normalizePlPostcode("00001")).toBe("00-001");
    expect(normalizePlPostcode("123")).toBeNull();
  });

  it("resolves input with optional city", () => {
    expect(resolvePlPostcodeInput("00-001", "Warszawa")).toBe("00-001");
  });
});
