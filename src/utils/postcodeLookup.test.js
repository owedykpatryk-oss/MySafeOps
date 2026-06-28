import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { lookupUkPostcode } from "./postcodeLookup.js";

describe("postcodeLookup", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => ({
        ok: true,
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
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls same-origin proxy URL", async () => {
    const result = await lookupUkPostcode("KT22 7SH");
    expect(fetch).toHaveBeenCalledWith("/api/postcode/KT227SH", expect.any(Object));
    expect(result?.postcode).toBe("KT22 7SH");
    expect(result?.lat).toBe(51.2);
  });
});
