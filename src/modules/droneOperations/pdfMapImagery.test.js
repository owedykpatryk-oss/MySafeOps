import { it, expect } from "vitest";
import { imageryFrame, mercator, loadPdfMapImagery } from "./pdfMapImagery.js";
const collection = (coordinates) => ({
  type: "FeatureCollection",
  features: coordinates.map((coordinate) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: coordinate },
  })),
});
it("fits all operating points with padding in the same projection and aspect ratio as the image", () => {
  const points = [
    [-0.12, 51.5],
    [-0.1, 51.51],
    [-0.13, 51.49],
  ];
  const frame = imageryFrame(collection(points));
  const [west, south, east, north] = frame.bounds;
  expect((east - west) / (north - south)).toBeCloseTo(178 / 145, 9);
  for (const point of points) {
    const [x, y] = mercator(point);
    expect(x).toBeGreaterThan(west);
    expect(x).toBeLessThan(east);
    expect(y).toBeGreaterThan(south);
    expect(y).toBeLessThan(north);
  }
  expect(new URL(frame.url).searchParams.get("bboxSR")).toBe("3857");
  expect(new URL(frame.url).searchParams.get("size")).toBe("1424,1160");
});
it("handles a single location and missing geometry without an invalid image request", async () => {
  expect(imageryFrame(collection([[115.86, -31.95]])).bounds.every(Number.isFinite)).toBe(true);
  expect(imageryFrame(null)).toBeNull();
  expect((await loadPdfMapImagery(null)).unavailable).toBeTruthy();
  expect(() => mercator([0, 90])).toThrow();
  expect(() =>
    imageryFrame(
      collection([
        [-179, 0],
        [179, 0],
      ])
    )
  ).toThrow(/antimeridian/);
});
