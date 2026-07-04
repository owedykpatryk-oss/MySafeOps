/** Strip OpenWeather payload to fields used by the client (reduces leakage of internal ids). */
export function sanitizeOpenWeatherPayload(raw, meta = {}) {
  if (!raw || typeof raw !== "object") return raw;
  const out = {
    cod: raw.cod,
    name: raw.name,
    main: raw.main
      ? {
          temp: raw.main.temp,
          feels_like: raw.main.feels_like,
          temp_min: raw.main.temp_min,
          temp_max: raw.main.temp_max,
          humidity: raw.main.humidity,
        }
      : undefined,
    wind: raw.wind ? { speed: raw.wind.speed, deg: raw.wind.deg, gust: raw.wind.gust } : undefined,
    weather: Array.isArray(raw.weather)
      ? raw.weather.map((w) => ({
          main: w.main,
          description: w.description,
          icon: w.icon,
        }))
      : undefined,
  };
  if (meta.postcode || meta.lat != null) {
    out._mysafeops = {
      postcode: meta.postcode,
      lat: meta.lat,
      lng: meta.lng,
    };
  }
  return out;
}
