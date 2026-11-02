import { describe, expect, it } from "vitest";
import {
  archiveFrameDraft,
  archiveFrameFact,
  dedupeFrames,
  gprSitePoint,
  markerPixel,
  parseWaybackConfig,
  selectReleaseSpread,
  nlsTileRequest,
  tileIndex,
  waybackTileUrl,
} from "./gprHistoricImagery.js";

describe("historic archive frames", () => {
  const releases = [
    { release: "a", date: "2014-02-20" },
    { release: "b", date: "2018-05-16" },
    { release: "c", date: "2022-01-01" },
    { release: "d", date: "2026-08-05" },
  ];

  it("uses the survey start coordinate before the project pin", () => {
    expect(gprSitePoint(
      { preSurvey: { lat: 55.1, lng: -4.2 }, groundConditions: { queryLat: 1, queryLng: 2 } },
      { lat: 9, lng: 8 },
    )).toEqual({ lat: 55.1, lng: -4.2 });
  });

  it("reads Wayback release dates and keeps the oldest and newest in a spread", () => {
    const parsed = parseWaybackConfig({
      1: { itemTitle: "World Imagery (Wayback 2014-02-20)", itemURL: "https://tiles.example/tile/1/{level}/{row}/{col}", itemID: "abc" },
      2: { itemTitle: "not a date", itemURL: "https://tiles.example/{level}/{row}/{col}", itemID: "nope" },
    });
    expect(parsed).toEqual([expect.objectContaining({ release: "1", date: "2014-02-20", itemId: "abc" })]);
    const spread = selectReleaseSpread(releases, 2);
    expect(spread.map((item) => item.date)).toEqual(["2014-02-20", "2026-08-05"]);
  });

  it("allows only the two dated NLS sheet series", () => {
    const tile = tileIndex(55.864, -4.433, 17);
    const ok = nlsTileRequest("os_6_inch_1888_1913", 17, tile.col, tile.row);
    expect(ok.upstream).toContain("nls.tileserver.com/os_6_inch_1888_1913/17/");
    expect(nlsTileRequest("os_modern", 17, tile.col, tile.row)).toBeNull();
    expect(nlsTileRequest("os_6_inch_1888_1913", 4, tile.col, tile.row)).toBeNull();
  });

  it("places the survey coordinate inside its own tile", () => {
    const tile = tileIndex(55.864, -4.433, 17);
    const marker = markerPixel(55.864, -4.433, 17, tile.col, tile.row);
    expect(marker.x).toBeGreaterThanOrEqual(0);
    expect(marker.x).toBeLessThan(256);
    expect(marker.y).toBeGreaterThanOrEqual(0);
    expect(marker.y).toBeLessThan(256);
    expect(waybackTileUrl("https://tiles.example/{level}/{row}/{col}", 17, tile.row, tile.col))
      .toBe(`https://tiles.example/17/${tile.row}/${tile.col}`);
  });

  it("collapses identical pixels and does not invent a land-use fact", () => {
    const unique = dedupeFrames([
      { signature: "same", date: "2024-01-01", release: "1" },
      { signature: "same", date: "2019-01-01", release: "2" },
      { signature: "other", date: "2014-02-20", release: "3" },
    ]);
    expect(unique).toHaveLength(2);
    expect(unique[0].releaseDates).toEqual(["2014-02-20"]);
    expect(unique[1].releaseDates).toEqual(["2019-01-01", "2024-01-01"]);
    const fact = archiveFrameFact(unique[1], { lat: 55.86421, lng: -4.43311 });
    expect(fact).toContain("2019-01-01");
    expect(fact).toContain("55.86421");
    expect(fact.toLowerCase()).not.toContain("building");
    expect(fact.toLowerCase()).not.toContain("cemetery");
    const draft = archiveFrameDraft(unique[1], { lat: 55.86421, lng: -4.43311 }, "data:image/jpeg;base64,aaaa");
    expect(draft.verified).toBe(false);
    expect(draft.kind).toBe("satellite");
    expect(draft.sourceUrl).toBe("");
  });
});
