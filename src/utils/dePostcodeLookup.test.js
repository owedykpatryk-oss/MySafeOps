import { describe, expect, it } from "vitest";
import { normalizeDePostcode, resolveDePostcodeInput } from "./dePostcodeLookup";

describe("dePostcodeLookup", () => {
  it("normalises five-digit German postcodes", () => {
    expect(normalizeDePostcode("10115")).toBe("10115");
    expect(normalizeDePostcode("10115 Berlin")).toBe("10115");
    expect(normalizeDePostcode("1011")).toBeNull();
  });

  it("resolves postcode from mixed address input", () => {
    expect(resolveDePostcodeInput("Berlin", "10115")).toBe("10115");
  });
});
