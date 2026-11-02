/** @vitest-environment jsdom */
import { it, expect } from "vitest";
import { airspaceBriefing } from "./airspaceBriefing.js";
import { mapExport } from "./mapTools.js";
import { parseDroneGeometry } from "./droneGeometry.js";
const area = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-0.1, 51.5],
            [-0.09, 51.5],
            [-0.09, 51.51],
            [-0.1, 51.51],
            [-0.1, 51.5],
          ],
        ],
      },
    },
  ],
};
it("prepares UTC time, every operating layer and landing points without marking checks complete", () => {
  const m = {
    title: "QA",
    revision: 4,
    regionCode: "uk",
    timeZone: "Europe/London",
    start: "2026-07-01T10:00",
    end: "2026-07-01T11:00",
    heightM: 60,
    heightReference: "AGL",
    flightArea: area,
    safetyArea: area,
    takeoff: [-0.11, 51.49],
    evidence: [],
  };
  const b = airspaceBriefing(m);
  expect(b.warnings).toEqual([]);
  expect(b.text).toContain("2026-07-01T09:00:00.000Z");
  expect(b.text).toContain("60 m AGL");
  expect(b.text).toContain("not connected");
  expect(b.text).toContain("-0.110000");
  expect(m.evidence).toEqual([]);
  const file = mapExport({ ...m, boundary: b.geometry }, "boundary", "kml");
  expect(parseDroneGeometry(file.content, "kml").features).toHaveLength(3);
  expect(file.content).toContain("flightArea");
});
it("labels a survey boundary provisional and switches sources for Australia", () => {
  const b = airspaceBriefing({ regionCode: "au", boundary: area });
  expect(b.hasGeometry).toBe(true);
  expect(b.warnings).toHaveLength(3);
  expect(b.text).toContain("flight area missing");
  expect(b.sources[0].url).toContain("naips");
  expect(airspaceBriefing({}).hasGeometry).toBe(false);
});
