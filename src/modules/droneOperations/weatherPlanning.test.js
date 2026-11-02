import { expect, it } from "vitest";
import { weatherReadiness, matchingWeatherSetup } from "./weatherPlanning.js";
const now = Date.parse("2026-10-30T10:00:00Z");
const mission = {
  regionCode: "uk",
  timeZone: "Europe/London",
  start: "2026-10-30T11:00",
  end: "2026-10-30T12:00",
  flightArea: {
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
              [-0.1, 51.5],
            ],
          ],
        },
      },
    ],
  },
};
it("waits for an explicit flight area and schedule without using the survey boundary as permission", () => {
  expect(weatherReadiness({ ...mission, flightArea: null, boundary: mission.flightArea }, now)).toMatchObject({
    ready: false,
    action: "map",
  });
  expect(weatherReadiness({ ...mission, start: "" }, now)).toMatchObject({ ready: false, action: "schedule" });
  expect(weatherReadiness(mission, now).ready).toBe(true);
});
it("waits for the provider horizon and rejects unsupported coordinates before requesting", () => {
  expect(weatherReadiness({ ...mission, start: "2026-12-01T11:00", end: "2026-12-01T12:00" }, now).ready).toBe(false);
  expect(weatherReadiness(mission, now + 86400000).ready).toBe(false);
  expect(weatherReadiness({ ...mission, regionCode: "au", timeZone: "Australia/Perth" }, now).ready).toBe(false);
});
it("only offers saved limits matching aircraft, payload, profile and region", () => {
  const m = { regionCode: "uk", assetId: "drone1", payloadAssetId: "sensor1", profileId: "profile1", payloadId: "rgb" };
  const setup = {
    ...m,
    id: "saved",
    limits: { wind: 5, gust: 8, rain: 0, minTemp: 0, maxTemp: 35, visibility: 1500, confirmed: true },
  };
  expect(matchingWeatherSetup(m, [setup])).toEqual(setup);
  for (const change of [
    { assetId: "other" },
    { payloadAssetId: "other" },
    { regionCode: "au" },
    { limits: {} },
    { deletedAt: "now" },
  ])
    expect(matchingWeatherSetup(m, [{ ...setup, ...change }])).toBeUndefined();
});
