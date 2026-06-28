import { describe, expect, it, vi, afterEach } from "vitest";
import {
  extractUkPostcode,
  lookupUkPostcode,
  normaliseUkPostcodeInput,
  resolveUkPostcodeInput,
} from "./postcodeLookup.js";

function mockFetch(handler) {
  vi.stubGlobal("fetch", vi.fn(handler));
}

describe("normaliseUkPostcodeInput", () => {
  it("accepts compact and spaced postcodes", () => {
    expect(normaliseUkPostcodeInput("kt227sh")).toBe("KT22 7SH");
    expect(normaliseUkPostcodeInput("KT22 7SH")).toBe("KT22 7SH");
    expect(normaliseUkPostcodeInput("KT22-7SH")).toBe("KT22 7SH");
  });

  it("rejects invalid lengths", () => {
    expect(normaliseUkPostcodeInput("KT2")).toBe("");
    expect(normaliseUkPostcodeInput("")).toBe("");
  });
});

describe("extractUkPostcode", () => {
  it("finds postcode inside address text", () => {
    expect(extractUkPostcode("Unit 4, Leatherhead KT22 7SH")).toBe("KT22 7SH");
    expect(extractUkPostcode("near KT227SH")).toBe("KT22 7SH");
  });
});

describe("resolveUkPostcodeInput", () => {
  it("prefers dedicated postcode field", () => {
    expect(resolveUkPostcodeInput("SW1A1AA", "KT22 7SH in address")).toBe("SW1A 1AA");
  });

  it("falls back to address text", () => {
    expect(resolveUkPostcodeInput("", "Site at KT227SH")).toBe("KT22 7SH");
  });
});

describe("lookupUkPostcode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls same-origin proxy URL with query param", async () => {
    mockFetch(async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          result: {
            postcode: "KT22 7SH",
            latitude: 51.2,
            longitude: -0.3,
            admin_district: "Mole Valley",
            region: "South East",
            country: "England",
          },
        }),
    }));

    const result = await lookupUkPostcode("KT22 7SH");
    expect(fetch).toHaveBeenCalledWith("/api/postcode?code=KT227SH", expect.any(Object));
    expect(result?.postcode).toBe("KT22 7SH");
    expect(result?.lat).toBe(51.2);
  });

  it("falls back to postcodes.io when proxy returns HTML", async () => {
    mockFetch(async (url) => {
      const u = String(url);
      if (u.startsWith("/api/postcode")) {
        return {
          ok: true,
          headers: { get: () => "text/html" },
          text: async () => "<!DOCTYPE html><html></html>",
        };
      }
      return {
        ok: true,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            result: {
              postcode: "KT22 7SH",
              latitude: 51.299424,
              longitude: -0.33181,
              admin_district: "Mole Valley",
              region: "South East",
              country: "England",
            },
          }),
      };
    });

    const result = await lookupUkPostcode("KT227SH");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toContain("api.postcodes.io");
    expect(result?.postcode).toBe("KT22 7SH");
  });
});
