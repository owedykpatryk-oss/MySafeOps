import { describe, it, expect } from "vitest";
import { buildGeoPhotoSitePlanSvg, geoPhotoSitePlanUrl } from "./geoPhotoSitePlan";

const NORTH = { id: "a", type: "hazard", latitude: 51.502, longitude: -0.1, bearing: 90, figureNum: 1 };
const SOUTH = { id: "b", type: "vegetation", latitude: 51.5, longitude: -0.1, figureNum: 2 };
const EAST = { id: "c", type: "trial_pit", latitude: 51.501, longitude: -0.097, figureNum: 3 };

/** Centre of each numbered marker, so the geometry can be checked rather than the markup. */
function markers(svg) {
  return [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="7"[^>]*\/><text[^>]*>(\d+)<\/text>/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    label: m[3],
  }));
}

describe("geoPhotoSitePlan", () => {
  it("plots the photos in their true relative positions, north up", () => {
    const svg = buildGeoPhotoSitePlanSvg([NORTH, SOUTH, EAST]);
    const [north, south, east] = ["1", "2", "3"].map((label) => markers(svg).find((m) => m.label === label));

    // SVG y grows downwards, so the northern photo must sit higher up the page.
    expect(north.y).toBeLessThan(south.y);
    expect(east.x).toBeGreaterThan(north.x);
    expect(markers(svg)).toHaveLength(3);
  });

  it("numbers the markers by report figure, so the plan reads against the photographs", () => {
    const svg = buildGeoPhotoSitePlanSvg([{ ...NORTH, figureNum: 7 }, { ...SOUTH, figureNum: 8 }]);
    expect(markers(svg).map((m) => m.label)).toEqual(["7", "8"]);
  });

  it("falls back to counting when the photos carry no figure numbers", () => {
    const svg = buildGeoPhotoSitePlanSvg([{ ...NORTH, figureNum: undefined }, { ...SOUTH, figureNum: undefined }]);
    expect(markers(svg).map((m) => m.label)).toEqual(["1", "2"]);
  });

  it("shades the ground each extent covers and says how much it adds up to", () => {
    const svg = buildGeoPhotoSitePlanSvg([
      NORTH,
      {
        ...SOUTH,
        area: {
          points: [
            [51.5, -0.1],
            [51.5009, -0.1],
            [51.5009, -0.09855],
            [51.5, -0.09855],
          ],
        },
      },
    ]);

    expect(svg).toContain("<polygon");
    expect(svg).toContain("1 extent shaded (1.00 ha)");
  });

  it("carries a scale bar and a north arrow, because a plan without them cannot be read", () => {
    const svg = buildGeoPhotoSitePlanSvg([NORTH, SOUTH]);
    expect(svg).toMatch(/>\d+ m<\/text>/);
    expect(svg).toContain(">N</text>");
    expect(svg).toContain("Indicative — GPS positions");
  });

  it("draws a view arrow only where the camera direction was captured", () => {
    const withBearing = buildGeoPhotoSitePlanSvg([NORTH, SOUTH]);
    expect(withBearing.match(/<line[^>]*stroke-linecap="round"/g)).toHaveLength(1);
  });

  it("caps the markers it plots, so a big register stays legible", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...NORTH, id: `p${i}`, latitude: 51.5 + i * 0.0002 }));
    expect(markers(buildGeoPhotoSitePlanSvg(many, { maxMarkers: 10 }))).toHaveLength(10);
  });

  it("gives a lone photo a plot to sit in rather than dividing by nothing", () => {
    const svg = buildGeoPhotoSitePlanSvg([NORTH]);
    const [only] = markers(svg);
    expect(Number.isFinite(only.x)).toBe(true);
    expect(Number.isFinite(only.y)).toBe(true);
  });

  it("keeps every marker and shaded extent inside the frame, clear of the scale bar", () => {
    const spread = [
      { id: "1", type: "site_entrance", latitude: 51.5, longitude: -0.1, bearing: 20, figureNum: 1 },
      {
        id: "2",
        type: "vegetation",
        latitude: 51.5012,
        longitude: -0.0985,
        figureNum: 2,
        area: {
          points: [
            [51.501, -0.099],
            [51.5016, -0.099],
            [51.5016, -0.0975],
            [51.501, -0.0975],
          ],
        },
      },
      { id: "3", type: "trial_pit", latitude: 51.4996, longitude: -0.0972, bearing: 200, figureNum: 3 },
    ];
    const svg = buildGeoPhotoSitePlanSvg(spread, { width: 520, height: 260 });
    const ring = svg
      .match(/<polygon points="([^"]+)"/)[1]
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
    const plotted = [...markers(svg).map((m) => [m.x, m.y]), ...ring];

    expect(plotted.every(([x]) => x >= 8 && x <= 512)).toBe(true);
    expect(plotted.every(([, y]) => y >= 8 && y <= 226)).toBe(true);
  });

  it("draws nothing without coordinates", () => {
    expect(buildGeoPhotoSitePlanSvg([])).toBe("");
    expect(buildGeoPhotoSitePlanSvg([{ id: "x", type: "hazard" }])).toBe("");
    expect(geoPhotoSitePlanUrl([])).toBe("");
  });

  it("returns an inline data URL, so print and PDF never wait on a tile host", () => {
    const url = geoPhotoSitePlanUrl([NORTH, SOUTH]);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(url).not.toContain("http://");
    expect(decodeURIComponent(url.split(",")[1])).toContain("<svg");
  });
});
