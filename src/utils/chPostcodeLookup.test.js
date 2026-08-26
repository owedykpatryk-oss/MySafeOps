import { describe, expect, it } from "vitest";
import { normalizeChPostcode, resolveChPostcodeInput } from "./chPostcodeLookup";

describe("chPostcodeLookup", () => {
  it("normalizes 4-digit Swiss PLZ", () => {
    expect(normalizeChPostcode("8001")).toBe("8001");
    expect(normalizeChPostcode("CH-8001")).toBe("8001");
    expect(normalizeChPostcode("10115")).toBe(null);
  });

  it("resolves postcode from mixed input", () => {
    expect(resolveChPostcodeInput("8001 Zürich")).toBe("8001");
  });
});
