import { it, expect } from "vitest";
import { normaliseForecast, evaluateForecast, forecastRequest } from "./droneWeather.js";
import { forecastWindows } from "./droneWeatherAssessment.js";

it("only recommends hours covered at every point and clips them to the mission window", () => {
  const limits = { wind: 10, gust: 12, rain: 1, minTemp: 0, maxTemp: 40, visibility: 1000, confirmed: true };
  const hour = { wind: 1, gust: 1, rain: 0, temp: 12, visibility: 5000 };
  const hours = [10, 11, 12].map((h) => ({ ...hour, at: `2026-10-29T${h}:00:00Z` }));
  const forecast = { points: [{ hours }, { hours: [hours[0], { ...hours[1], gust: 20 }] }] };
  expect(forecastWindows(forecast, limits, "2026-10-29T10:30:00Z", "2026-10-29T13:00:00Z")).toEqual([
    { start: "2026-10-29T10:30:00.000Z", end: "2026-10-29T11:00:00.000Z" },
  ]);
  expect(forecastWindows(forecast, { ...limits, confirmed: false }, hours[0].at, hours[2].at)).toEqual([]);
});
it("never converts missing weather into a calm flight window", () => {
  expect(() => normaliseForecast({ hourly: { time: [1793268000], wind_speed_10m: [null] } }, [[0, 51]])).toThrow();
  expect(evaluateForecast({ points: [] }, { wind: 10, gust: 12, confirmed: true }).status).toBe("Not checked");
});
it("requires confirmed limits and flags actual exceedances", () => {
  const data = {
    points: [{ hours: [{ at: "2026-10-29T10:00:00Z", wind: 8, gust: 15, rain: 0, temp: 12, visibility: 10000 }] }],
  };
  expect(evaluateForecast(data, {}).status).toBe("Limits not confirmed");
  const result = evaluateForecast(data, {
    wind: 10,
    gust: 12,
    rain: 0,
    minTemp: 0,
    maxTemp: 40,
    visibility: 5000,
    confirmed: true,
  });
  expect(result.hours[0].warnings).toContain("Gust exceeds confirmed limit");
});
it("requires flight geometry and a valid window for a forecast request", () => {
  expect(() => forecastRequest({})).toThrow();
});
