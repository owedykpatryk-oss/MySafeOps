import { describe, it, expect } from "vitest";
import {
  AREA_OFFSET_WARN_M,
  MAX_AREA_VERTICES,
  formatAreaSqm,
  formatGeoPhotoArea,
  formatLengthM,
  geoPhotoAreaDraft,
  geoPhotoAreaOf,
  geoPhotoAreaOffsetM,
  geoPhotoAreaPrompt,
  geoPhotoTypeWantsArea,
  normaliseAreaPoints,
  normaliseGeoPhotoArea,
  polygonAreaSqm,
  polygonCentroid,
  polygonPerimeterM,
  summariseGeoPhotoExtents,
} from "./geoPhotoArea";

/** ~100 m square near London: 0.0009° of latitude is 100 m, longitude scaled by cos(lat). */
const SQUARE_100M = [
  [51.5, -0.1],
  [51.5009, -0.1],
  [51.5009, -0.09855],
  [51.5, -0.09855],
];

describe("geoPhotoArea", () => {
  describe("cleaning up what the map hands over", () => {
    it("keeps valid corners and drops anything that is not a coordinate", () => {
      expect(
        normaliseAreaPoints([[51.5, -0.1], ["nope", 2], [200, 0], [0, 400], null, { lat: 51.6, lng: -0.2 }])
      ).toEqual([
        [51.5, -0.1],
        [51.6, -0.2],
      ]);
    });

    it("ignores a repeated tap on the same spot", () => {
      expect(normaliseAreaPoints([[51.5, -0.1], [51.5, -0.1], [51.6, -0.2]])).toEqual([
        [51.5, -0.1],
        [51.6, -0.2],
      ]);
    });

    it("stores the ring open, because the closing leg is implied", () => {
      expect(normaliseAreaPoints([...SQUARE_100M, SQUARE_100M[0]])).toEqual(SQUARE_100M);
    });

    it("stops a stuck finger from bloating the row", () => {
      const many = Array.from({ length: 500 }, (_, i) => [51.5 + i * 0.0001, -0.1]);
      expect(normaliseAreaPoints(many)).toHaveLength(MAX_AREA_VERTICES);
    });
  });

  describe("measuring the traced ground", () => {
    it("measures a 100 m square to within a percent", () => {
      expect(polygonAreaSqm(SQUARE_100M)).toBeGreaterThan(9900);
      expect(polygonAreaSqm(SQUARE_100M)).toBeLessThan(10100);
    });

    it("measures the way round it, closing leg included", () => {
      expect(polygonPerimeterM(SQUARE_100M)).toBeGreaterThan(396);
      expect(polygonPerimeterM(SQUARE_100M)).toBeLessThan(404);
    });

    it("reads a line as a line, not an area", () => {
      expect(polygonAreaSqm([[51.5, -0.1], [51.5009, -0.1]])).toBe(0);
      expect(polygonPerimeterM([[51.5, -0.1], [51.5009, -0.1]])).toBeGreaterThan(99);
    });

    it("centres a label inside the shape", () => {
      expect(polygonCentroid(SQUARE_100M)).toEqual([51.50045, -0.099275]);
      expect(polygonCentroid([])).toBeNull();
    });
  });

  describe("what gets saved", () => {
    it("keeps a closed shape with its size", () => {
      const area = normaliseGeoPhotoArea({ points: SQUARE_100M });
      expect(area.points).toEqual(SQUARE_100M);
      expect(area.sqm).toBeGreaterThan(9900);
      expect(area.perimeterM).toBeGreaterThan(396);
    });

    it("recomputes rather than trusting a size that arrived with the row", () => {
      expect(normaliseGeoPhotoArea({ points: SQUARE_100M, sqm: 999999 }).sqm).toBeLessThan(10100);
    });

    it("refuses anything short of a closed shape", () => {
      expect(normaliseGeoPhotoArea({ points: SQUARE_100M.slice(0, 2) })).toBeNull();
      expect(normaliseGeoPhotoArea(null)).toBeNull();
      expect(normaliseGeoPhotoArea({ points: "nope" })).toBeNull();
      expect(geoPhotoAreaOf({ type: "vegetation" })).toBeNull();
    });

    it("accepts a bare ring as well as the stored shape", () => {
      expect(normaliseGeoPhotoArea(SQUARE_100M).points).toEqual(SQUARE_100M);
    });

    it("keeps a half-drawn shape while tracing, so the map can show a running total", () => {
      const draft = geoPhotoAreaDraft(SQUARE_100M.slice(0, 2));
      expect(draft.points).toHaveLength(2);
      expect(draft.sqm).toBe(0);
      expect(geoPhotoAreaDraft([])).toBeNull();
    });
  });

  describe("how sizes read", () => {
    it("uses square metres on site and hectares once it is a field", () => {
      expect(formatAreaSqm(4.25)).toBe("4.3 m²");
      expect(formatAreaSqm(1240)).toBe("1,240 m²");
      expect(formatAreaSqm(24000)).toBe("2.40 ha");
      expect(formatAreaSqm(0)).toBe("");
      expect(formatAreaSqm("nonsense")).toBe("");
    });

    it("measures distance in metres, then kilometres", () => {
      expect(formatLengthM(145.4)).toBe("145 m");
      expect(formatLengthM(2500)).toBe("2.50 km");
      expect(formatLengthM(null)).toBe("");
    });

    it("gives tables one value carrying both figures", () => {
      expect(formatGeoPhotoArea({ points: SQUARE_100M })).toMatch(/^1\.00 ha · \d+ m perimeter$/);
      expect(formatGeoPhotoArea(null)).toBe("");
    });
  });

  describe("adding up what has been traced", () => {
    const photos = [
      { id: "a", type: "vegetation", area: { points: SQUARE_100M } },
      { id: "b", type: "obstruction", area: { points: SQUARE_100M.slice(0, 3) } },
      { id: "c", type: "hazard" },
    ];

    it("counts the extents, totals the ground and names the biggest", () => {
      const summary = summariseGeoPhotoExtents(photos);
      expect(summary.count).toBe(2);
      expect(summary.totalSqm).toBeGreaterThan(14000);
      expect(summary.largest.id).toBe("a");
    });

    it("reports nothing when no one has traced anything", () => {
      expect(summariseGeoPhotoExtents([{ type: "hazard" }])).toEqual({ count: 0, totalSqm: 0, largest: null });
      expect(summariseGeoPhotoExtents(null).count).toBe(0);
    });
  });

  describe("catching a boundary traced on the wrong ground", () => {
    it("measures to the nearest corner, so a big extent is not flagged for being big", () => {
      const onIt = { latitude: 51.5, longitude: -0.1, area: { points: SQUARE_100M } };
      expect(geoPhotoAreaOffsetM(onIt)).toBe(0);

      const nearby = { latitude: 51.4995, longitude: -0.1, area: { points: SQUARE_100M } };
      expect(geoPhotoAreaOffsetM(nearby)).toBeLessThan(AREA_OFFSET_WARN_M);
    });

    it("flags a ring traced streets away from the photo", () => {
      const strayed = { latitude: 51.52, longitude: -0.12, area: { points: SQUARE_100M } };
      expect(geoPhotoAreaOffsetM(strayed)).toBeGreaterThan(AREA_OFFSET_WARN_M);
    });

    it("says nothing when there is no extent or no fix to compare it with", () => {
      expect(geoPhotoAreaOffsetM({ latitude: 51.5, longitude: -0.1 })).toBeNull();
      expect(geoPhotoAreaOffsetM({ area: { points: SQUARE_100M } })).toBeNull();
    });
  });

  describe("offering an extent up front", () => {
    it("asks the types where the size is half the observation", () => {
      expect(geoPhotoTypeWantsArea("vegetation")).toBe(true);
      expect(geoPhotoTypeWantsArea("manhole_chamber")).toBe(false);
      expect(geoPhotoAreaPrompt("vegetation")).toMatch(/clearance/i);
      expect(geoPhotoAreaPrompt("manhole_chamber")).toBeTruthy();
    });
  });
});
