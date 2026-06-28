import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { lookupUkPostcode } from "./postcodeLookup.js";

function mockFetch(handler) {
  vi.stubGlobal("fetch", vi.fn(handler));
}

describe("postcodeLookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls same-origin proxy URL with query param", async () => {
    mockFetch(async (url) => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
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
          json: async () => {
            throw new Error("Unexpected token");
          },
        };
      }
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({
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

    const result = await lookupUkPostcode("KT22 7SH");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toContain("api.postcodes.io");
    expect(result?.postcode).toBe("KT22 7SH");
  });
});
