import { describe, expect, it } from "vitest";
import { normalizeAtPostcode, resolveAtPostcodeInput } from "./atPostcodeLookup";

describe("atPostcodeLookup", () => {
  it("normalizes 4-digit Austrian PLZ", () => {
    expect(normalizeAtPostcode("1010")).toBe("1010");
    expect(normalizeAtPostcode("A-1010")).toBe("1010");
    expect(normalizeAtPostcode("10115")).toBe(null);
  });

  it("resolves postcode from mixed input", () => {
    expect(resolveAtPostcodeInput("1010 Wien")).toBe("1010");
  });
});
