import { describe, expect, it } from "vitest";
import {
  pointInRing,
  geometryContainsPoint,
  pickBestGeologyFeature,
  BGS_625K_DISCLAIMER,
} from "../../shared/bgsGeologyPick.mjs";

describe("bgsGeologyPick", () => {
  it("detects point inside a simple square ring", () => {
    const ring = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    expect(pointInRing(1, 1, ring)).toBe(true);
    expect(pointInRing(3, 1, ring)).toBe(false);
  });

  it("prefers containing polygon over neighbour in bbox", () => {
    const neighbour = {
      properties: { lex_d: "NEIGHBOUR" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    };
    const target = {
      properties: { lex_d: "TARGET" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [1.5, 1.5],
            [3, 1.5],
            [3, 3],
            [1.5, 3],
            [1.5, 1.5],
          ],
        ],
      },
    };
    const pick = pickBestGeologyFeature([neighbour, target], 2, 2);
    expect(pick.properties.lex_d).toBe("TARGET");
    expect(geometryContainsPoint(target.geometry, 2, 2)).toBe(true);
  });

  it("exports honesty disclaimer", () => {
    expect(BGS_625K_DISCLAIMER).toMatch(/not a site investigation/i);
  });
});
