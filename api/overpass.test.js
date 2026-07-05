import { describe, expect, it } from "vitest";

function clampRadiusM(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 25_000;
  return Math.max(500, Math.min(50_000, Math.round(n)));
}

function buildHospitalQuery(lat, lng, radiusM) {
  return `
[out:json][timeout:15];
(
  node(around:${radiusM},${lat},${lng})["amenity"="hospital"];
  node(around:${radiusM},${lat},${lng})["healthcare"="hospital"];
);
out body;
`.trim();
}

describe("overpass proxy helpers", () => {
  it("clamps search radius", () => {
    expect(clampRadiusM(999_999)).toBe(50_000);
    expect(clampRadiusM(100)).toBe(500);
    expect(clampRadiusM(12_000)).toBe(12_000);
  });

  it("builds hospital-only Overpass query", () => {
    const q = buildHospitalQuery(51.5, -0.12, 25_000);
    expect(q).toContain('["amenity"="hospital"]');
    expect(q).toContain("around:25000,51.5,-0.12");
  });
});
