import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchWeatherForPostcode, resolveSiteCoordinates } from "./weatherSummary.js";

describe("resolveSiteCoordinates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns explicit coordinates when valid", async () => {
    const hit = await resolveSiteCoordinates("51.299424", "-0.33181");
    expect(hit).toEqual({ lat: 51.299424, lng: -0.33181 });
  });

  it("resolves UK postcode via proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            result: {
              postcode: "KT22 7SH",
              latitude: 51.299424,
              longitude: -0.33181,
            },
          }),
      }))
    );

    const hit = await resolveSiteCoordinates("", "", "KT22 7SH");
    expect(hit?.postcode).toBe("KT22 7SH");
    expect(hit?.lat).toBeCloseTo(51.299, 2);
  });
});

describe("fetchWeatherForPostcode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses weather proxy with postcode param in production mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("/api/weather?postcode=KT227SH")) {
          return {
            ok: true,
            json: async () => ({
              main: { temp: 18.2 },
              wind: { speed: 2 },
              weather: [{ icon: "04d", description: "overcast clouds" }],
            }),
          };
        }
        return { ok: false, status: 404 };
      })
    );

    const snap = await fetchWeatherForPostcode("KT22 7SH");
    expect(snap.source).toBe("openweather");
    expect(snap.text).toMatch(/OpenWeather/);
    expect(snap.text).toMatch(/18\.2°C/);
  });
});
