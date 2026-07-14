import { describe, expect, it, vi } from "vitest";
import { resolveProjectGeoAnchor } from "./resolveProjectGeoAnchor";

describe("resolveProjectGeoAnchor", () => {
  it("uses project lat/lng when present", async () => {
    const result = await resolveProjectGeoAnchor({ lat: "53.48", lng: "-2.24" });
    expect(result.source).toBe("project");
    expect(result.anchor.lat).toBeCloseTo(53.48, 2);
    expect(result.anchor.lng).toBeCloseTo(-2.24, 2);
  });

  it("looks up postcode when lat/lng missing", async () => {
    const lookup = vi.fn().mockResolvedValue({ lat: 51.32, lng: -0.33, postcode: "KT22 7SH" });
    const result = await resolveProjectGeoAnchor({ postcode: "KT22 7SH" }, { lookup });
    expect(lookup).toHaveBeenCalled();
    expect(result.source).toBe("postcode");
    expect(result.anchor.lat).toBeCloseTo(51.32, 2);
    expect(result.postcode).toBe("KT22 7SH");
  });

  it("falls back to London default when nothing resolves", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const result = await resolveProjectGeoAnchor({ postcode: "ZZ99 9ZZ" }, { lookup });
    expect(result.source).toBe("default");
    expect(result.anchor.lat).toBeCloseTo(51.505, 2);
  });
});
