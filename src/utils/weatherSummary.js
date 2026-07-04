/**
 * Site weather snapshot — OpenWeather via same-origin proxy (prod) or Open-Meteo (free fallback).
 */

import { lookupUkPostcode, resolveUkPostcodeInput } from "./postcodeLookup.js";

const WEATHER_PROXY_PATH = "/api/weather";

function openWeatherDescription(code = "", fallback = "") {
  const MAP = {
    "01d": "Clear",
    "01n": "Clear",
    "02d": "Partly cloudy",
    "02n": "Partly cloudy",
    "03d": "Cloudy",
    "03n": "Cloudy",
    "04d": "Overcast",
    "04n": "Overcast",
    "09d": "Rain",
    "09n": "Rain",
    "10d": "Rain",
    "10n": "Rain",
    "11d": "Thunderstorm",
    "11n": "Thunderstorm",
    "13d": "Snow",
    "13n": "Snow",
    "50d": "Mist",
    "50n": "Mist",
  };
  return MAP[code] || fallback || "Weather";
}

function isWeatherProxyPreferred() {
  if (import.meta.env.PROD) return true;
  return Boolean(String(import.meta.env.VITE_WEATHER_PROXY_URL || WEATHER_PROXY_PATH).trim());
}

function resolveWeatherProxyUrl(lat, lng, postcode) {
  const base = String(import.meta.env.VITE_WEATHER_PROXY_URL || WEATHER_PROXY_PATH).trim();
  const path = base.startsWith("/") ? base : `/${base}`;
  const u = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (postcode) {
    u.searchParams.set("postcode", String(postcode).replace(/\s/g, ""));
  } else {
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lng", String(lng));
  }
  return u.toString();
}

function formatOpenWeatherSnapshot(j, when) {
  const t = Number(j.main?.temp).toFixed(1);
  const w = Number(j.wind?.speed || 0) * 2.23694;
  const desc = openWeatherDescription(j.weather?.[0]?.icon || "", j.weather?.[0]?.description || "");
  return {
    text: `Site weather (${when}): ~${t}°C, ${desc}, wind ~${w.toFixed(1)} mph — OpenWeather snapshot.`,
    tempC: Number(j.main?.temp),
    description: desc,
    fetchedAt: new Date().toISOString(),
    source: "openweather",
  };
}

async function fetchOpenWeatherViaProxy(lat, lng, when, postcode) {
  const r = await fetch(resolveWeatherProxyUrl(lat, lng, postcode), { credentials: "same-origin" });
  if (r.status === 503) return null;
  if (r.status === 404 && postcode) return null;
  if (!r.ok) throw new Error("Weather request failed");
  const j = await r.json();
  return formatOpenWeatherSnapshot(j, when);
}

/**
 * Resolve lat/lng from explicit coords or UK postcode (client-side postcodes.io proxy).
 * @returns {Promise<{ lat: number, lng: number, postcode?: string } | null>}
 */
export async function resolveSiteCoordinates(lat, lng, postcodeHint) {
  const la = parseFloat(String(lat ?? "").trim(), 10);
  const lo = parseFloat(String(lng ?? "").trim(), 10);
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    return { lat: la, lng: lo };
  }
  const pc = resolveUkPostcodeInput(postcodeHint);
  if (!pc) return null;
  const hit = await lookupUkPostcode(pc);
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lng, postcode: hit.postcode };
}

/** @deprecated Dev-only — production must use OPENWEATHER_API_KEY on the server. */
async function fetchOpenWeatherDirect(lat, lng, when, apiKey) {
  const u = new URL("https://api.openweathermap.org/data/2.5/weather");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lng));
  u.searchParams.set("appid", apiKey);
  u.searchParams.set("units", "metric");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error("Weather request failed");
  const j = await r.json();
  return formatOpenWeatherSnapshot(j, when);
}

async function fetchOpenMeteoCurrent(lat, lng, when) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lng));
  u.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  u.searchParams.set("wind_speed_unit", "mph");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error("Weather request failed");
  const j = await r.json();
  const t = j.current?.temperature_2m;
  const w = j.current?.wind_speed_10m;
  const code = j.current?.weather_code;
  const WMO = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Drizzle",
    61: "Rain",
    80: "Rain showers",
    95: "Thunderstorm",
  };
  const desc = WMO[code] ?? `Weather code ${code}`;
  return {
    text: `Site weather (${when}): ~${t}°C, ${desc}, wind ~${w} mph — Open-Meteo snapshot.`,
    tempC: t,
    description: desc,
    fetchedAt: new Date().toISOString(),
    source: "open-meteo",
  };
}

/**
 * @param {number|string} lat
 * @param {number|string} lng
 * @param {{ whenLabel?: string, postcode?: string }} [opts]
 */
export async function fetchWeatherSummary(lat, lng, opts = {}) {
  const la = parseFloat(String(lat ?? "").trim(), 10);
  const lo = parseFloat(String(lng ?? "").trim(), 10);
  const hasCoords = Number.isFinite(la) && Number.isFinite(lo);
  const pcCompact = resolveUkPostcodeInput(opts.postcode)?.replace(/\s/g, "") || "";

  if (!hasCoords && !pcCompact) throw new Error("Invalid coordinates or postcode");

  const when =
    opts.whenLabel ||
    new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  if (isWeatherProxyPreferred()) {
    try {
      const proxied = hasCoords
        ? await fetchOpenWeatherViaProxy(la, lo, when)
        : await fetchOpenWeatherViaProxy(null, null, when, pcCompact);
      if (proxied) return proxied;
    } catch {
      /* fall through to Open-Meteo */
    }
  } else {
    const devKey = String(import.meta.env.VITE_OPENWEATHER_API_KEY || "").trim();
    if (devKey) {
      const coords = hasCoords ? { lat: la, lng: lo } : await resolveSiteCoordinates("", "", opts.postcode);
      if (!coords) throw new Error("Postcode not found");
      return fetchOpenWeatherDirect(coords.lat, coords.lng, when, devKey);
    }
  }

  const coords = hasCoords ? { lat: la, lng: lo } : await resolveSiteCoordinates("", "", opts.postcode);
  if (!coords) throw new Error("Postcode not found");
  return fetchOpenMeteoCurrent(coords.lat, coords.lng, when);
}

/** UK postcode → current weather (resolves coordinates automatically). */
export async function fetchWeatherForPostcode(postcode, opts = {}) {
  return fetchWeatherSummary("", "", { ...opts, postcode });
}

const WMO_DAILY = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  80: "Rain showers",
  95: "Thunderstorm",
};

function formatIsoDateLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Forecast for a specific date (project start). Uses Open-Meteo daily (free).
 * @param {number|string} lat
 * @param {number|string} lng
 * @param {string} isoDate YYYY-MM-DD
 */
export async function fetchWeatherForDate(lat, lng, isoDate, opts = {}) {
  const resolved = await resolveSiteCoordinates(lat, lng, opts.postcode);
  if (!resolved) throw new Error("Invalid coordinates or postcode");
  const la = resolved.lat;
  const lo = resolved.lng;
  const date = String(isoDate || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");

  const today = new Date().toISOString().slice(0, 10);
  if (date === today) {
    const cur = await fetchWeatherSummary(la, lo, opts);
    return { ...cur, targetDate: date, isForecast: false };
  }

  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(la));
  u.searchParams.set("longitude", String(lo));
  u.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max");
  u.searchParams.set("timezone", "auto");
  u.searchParams.set("start_date", date);
  u.searchParams.set("end_date", date);
  u.searchParams.set("wind_speed_unit", "mph");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error("Weather forecast request failed");
  const j = await r.json();
  const i = 0;
  const tMax = j.daily?.temperature_2m_max?.[i];
  const tMin = j.daily?.temperature_2m_min?.[i];
  const w = j.daily?.wind_speed_10m_max?.[i];
  const code = j.daily?.weather_code?.[i];
  const desc = WMO_DAILY[code] ?? `Weather code ${code}`;
  const when = formatIsoDateLabel(date);
  const tempBand =
    tMin != null && tMax != null ? `~${tMin}–${tMax}°C` : tMax != null ? `~${tMax}°C` : "—";
  return {
    text: `Forecast for ${when}: ${desc}, ${tempBand}, wind up to ~${w ?? "—"} mph — Open-Meteo.`,
    tempC: tMax,
    tempMinC: tMin,
    description: desc,
    fetchedAt: new Date().toISOString(),
    targetDate: date,
    isForecast: true,
    source: "open-meteo-daily",
  };
}
