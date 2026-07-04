import { describe, expect, it } from "vitest";
import { sanitizeOpenWeatherPayload } from "./weatherSanitize.js";

describe("sanitizeOpenWeatherPayload", () => {
  it("keeps weather fields and strips sys/id noise", () => {
    const raw = {
      cod: 200,
      name: "Leatherhead",
      sys: { id: 2012560, country: "GB" },
      main: { temp: 19.2, feels_like: 18.9, humidity: 70, pressure: 1026 },
      wind: { speed: 1.3, deg: 280, gust: 2.1 },
      weather: [{ id: 804, main: "Clouds", description: "overcast", icon: "04n" }],
    };
    const safe = sanitizeOpenWeatherPayload(raw, { postcode: "KT22 7SH", lat: 51.3, lng: -0.33 });
    expect(safe.sys).toBeUndefined();
    expect(safe.main?.temp).toBe(19.2);
    expect(safe._mysafeops?.postcode).toBe("KT22 7SH");
    expect(safe.weather?.[0]?.icon).toBe("04n");
  });
});
