import { describe, expect, it } from "vitest";
import { buildHospitalQuery } from "../src/utils/hospitalOverpassQuery.js";

function clampRadiusM(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 25_000;
  return Math.max(500, Math.min(50_000, Math.round(n)));
}

describe("overpass proxy helpers", () => {
  it("clamps search radius", () => {
    expect(clampRadiusM(999_999)).toBe(50_000);
    expect(clampRadiusM(100)).toBe(500);
    expect(clampRadiusM(12_000)).toBe(12_000);
  });

  it("builds hospital query with ways/relations and center output", () => {
    const q = buildHospitalQuery(51.5, -0.12, 25_000);
    expect(q).toContain('["amenity"="hospital"]');
    expect(q).toContain("nwr(around:25000,51.5,-0.12)");
    expect(q).toContain("out center tags");
    expect(q).toContain('["emergency"="yes"]');
  });
});
