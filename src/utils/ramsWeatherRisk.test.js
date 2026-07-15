import { describe, expect, it } from "vitest";
import {
  WEATHER_HAZARD_SOURCE_ID,
  isAdverseWeatherSnapshot,
  buildWeatherHazardTemplate,
  upsertWeatherHazardIntoRows,
} from "./ramsWeatherRisk";

describe("ramsWeatherRisk", () => {
  it("detects rain and high wind as adverse", () => {
    expect(isAdverseWeatherSnapshot({ description: "Rain", text: "Site weather: Rain" })).toBe(true);
    expect(isAdverseWeatherSnapshot({ text: "wind ~28 mph — OpenWeather" })).toBe(true);
    expect(isAdverseWeatherSnapshot({ description: "Clear", text: "wind ~8 mph" })).toBe(false);
  });

  it("builds outdoor row even in fair weather; skips indoor fair weather", () => {
    const fair = { description: "Clear", text: "Clear, wind ~5 mph" };
    expect(buildWeatherHazardTemplate({ outdoor: true, snap: fair })?.id).toBe(WEATHER_HAZARD_SOURCE_ID);
    expect(buildWeatherHazardTemplate({ outdoor: false, snap: fair })).toBeNull();
    expect(buildWeatherHazardTemplate({ outdoor: false, snap: { description: "Rain" } })).toBeTruthy();
  });

  it("upserts then updates existing weather row", () => {
    const tpl = buildWeatherHazardTemplate({ outdoor: true, snap: { description: "Rain" } });
    const first = upsertWeatherHazardIntoRows([], [], tpl);
    expect(first.added).toBe(true);
    expect(first.rows[0].sourceId).toBe(WEATHER_HAZARD_SOURCE_ID);
    const nextTpl = buildWeatherHazardTemplate({ outdoor: true, snap: { description: "Thunderstorm" } });
    const second = upsertWeatherHazardIntoRows(first.rows, first.selected, nextTpl);
    expect(second.updated).toBe(true);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0].hazard).toMatch(/Thunderstorm|Adverse/i);
  });
});
