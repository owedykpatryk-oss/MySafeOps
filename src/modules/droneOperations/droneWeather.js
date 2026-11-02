import { geometrySummary } from "./droneGeometry.js";
import { missionWindow } from "./droneMission.js";
import { regionOf } from "./droneRegions.js";
export function forecastRequest(m) {
  const window = missionWindow(m),
    summary = geometrySummary(m.flightArea);
  if (!summary.polygonCount) throw new Error("Define the flight area before fetching weather.");
  return { ...window, points: summary.weatherPoints, regionCode: regionOf(m) };
}
export function normaliseForecast(data, points) {
  const list = Array.isArray(data) ? data : [data];
  if (list.length !== points.length) throw new Error("Incomplete weather coverage.");
  return {
    points: list.map((p, index) => {
      const h = p.hourly;
      if (!h || !Array.isArray(h.time) || !h.time.length || h.time.length > 500)
        throw new Error("Invalid hourly forecast.");
      const fields = {
        wind: "wind_speed_10m",
        gust: "wind_gusts_10m",
        direction: "wind_direction_10m",
        rain: "precipitation",
        probability: "precipitation_probability",
        temp: "temperature_2m",
        visibility: "visibility",
        cloud: "cloud_cover",
      };
      const expectedUnits = {
        time: "unixtime",
        wind_speed_10m: "m/s",
        wind_gusts_10m: "m/s",
        precipitation: "mm",
        temperature_2m: "°C",
        visibility: "m",
      };
      if (Object.entries(expectedUnits).some(([k, v]) => p.hourly_units?.[k] !== v))
        throw new Error("Unexpected forecast units.");
      const hours = h.time.map((time, i) => {
        if (!Number.isFinite(time)) throw new Error("Invalid forecast time.");
        const values = { at: new Date(time * 1000).toISOString() };
        for (const [name, key] of Object.entries(fields)) {
          const value = h[key]?.[i];
          if (!Number.isFinite(value)) throw new Error("Forecast contains missing values; manual review required.");
          values[name] = value;
        }
        return values;
      });
      return {
        coordinate: points[index],
        hours,
        sunrise: (p.daily?.sunrise || []).map((t) => new Date(t * 1000).toISOString()),
        sunset: (p.daily?.sunset || []).map((t) => new Date(t * 1000).toISOString()),
      };
    }),
  };
}
export { evaluateForecast } from "./droneWeatherAssessment.js";
