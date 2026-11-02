import { describe, expect, it } from "vitest";
import { chooseGprArchiveComparison } from "./GprArchiveComparison.jsx";

const frame = (release, date, kind = "satellite", col = 1) => ({
  release, date, kind, releaseDates: [date], tileUrl: `https://example.org/${release}.png`,
  marker: { x: 100, y: 120 }, zoom: 17, col, row: 2,
});

describe("GPR archive comparison", () => {
  it("compares aligned historic imagery with the latest available mosaic", () => {
    const frames = [frame("old", "2014-05-01"), frame("new", "2025-09-01"), frame("map", "1892–1914", "historic_map")];
    const result = chooseGprArchiveComparison(frames);
    expect(result.latest.release).toBe("new");
    expect(result.historic.release).toBe("old");
    expect(chooseGprArchiveComparison(frames, "map").historic.release).toBe("map");
  });

  it("avoids comparing tiles at different coordinates or without a reference mosaic", () => {
    expect(chooseGprArchiveComparison([frame("map", "1892–1914", "historic_map")])).toBeNull();
    expect(chooseGprArchiveComparison([frame("old", "2014-05-01", "satellite", 1), frame("new", "2025-09-01", "satellite", 2)])).toBeNull();
  });
});
