/**
 * Vercel serverless: OpenWeather proxy — keeps OPENWEATHER_API_KEY server-side.
 * GET /api/weather?lat=51.5&lng=-0.12
 * GET /api/weather?postcode=KT227SH  (UK — postcodes.io)
 * GET /api/weather?postcode=2000     (AU — Nominatim)
 */

import {
  API_JSON_HEADERS,
  isSameSiteApiRequest,
  parseBoundedJson,
  rejectIfRateLimited,
  sendJson,
} from "./securityUtils.js";
import {
  lookupAuPostcodeCoords,
  lookupUkPostcodeCoords,
  normaliseUkPostcodeCompact,
  isValidUkPostcodeCompact,
  isValidAuPostcodeDigits,
} from "./postcodeUtils.js";
import { parseLatLng } from "./coordUtils.js";
import { sanitizeOpenWeatherPayload } from "./weatherSanitize.js";

const UPSTREAM = "https://api.openweathermap.org/data/2.5/weather";
const MAX_UPSTREAM_BYTES = 16_384;

async function resolveCoordinates(query) {
  const fromLatLng = parseLatLng(query?.lat, query?.lng ?? query?.lon);
  if (fromLatLng) return fromLatLng;

  const raw = String(query?.postcode || query?.code || "").trim();
  const compactUk = normaliseUkPostcodeCompact(raw);
  const auDigits = raw.replace(/\D/g, "");

  if (isValidAuPostcodeDigits(auDigits) && !isValidUkPostcodeCompact(compactUk)) {
    const au = await lookupAuPostcodeCoords(auDigits);
    if (!au) return { error: "postcode_not_found" };
    return { lat: au.lat, lng: au.lng, postcode: au.postcode };
  }

  if (!compactUk) return { error: "invalid_coordinates" };
  if (!isValidUkPostcodeCompact(compactUk)) return { error: "invalid_postcode" };

  const pc = await lookupUkPostcodeCoords(compactUk);
  if (!pc) return { error: "postcode_not_found" };
  return { lat: pc.lat, lng: pc.lng, postcode: pc.postcode };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  if (rejectIfRateLimited(req, res, "weather", { max: 60, windowMs: 60_000 })) return;

  const apiKey = String(process.env.OPENWEATHER_API_KEY || "").trim();
  if (!apiKey) {
    return sendJson(res, 503, { error: "openweather_not_configured" });
  }

  const resolved = await resolveCoordinates(req.query || {});
  if (resolved.error) {
    const status = resolved.error === "postcode_not_found" ? 404 : 400;
    return sendJson(res, status, { error: resolved.error });
  }

  const { lat, lng } = resolved;

  const u = new URL(UPSTREAM);
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lng));
  u.searchParams.set("appid", apiKey);
  u.searchParams.set("units", "metric");

  try {
    const upstream = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    const text = await upstream.text();
    const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
    if (parsed.error) {
      return sendJson(res, 502, { error: "weather_upstream_invalid" });
    }
    const body = parsed.value;
    const safe = sanitizeOpenWeatherPayload(body, {
      postcode: resolved.postcode,
      lat,
      lng,
    });
    res.writeHead(upstream.ok ? 200 : upstream.status, {
      ...API_JSON_HEADERS,
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
    });
    if (req.method === "HEAD") return res.end();
    return res.end(JSON.stringify(safe));
  } catch {
    return sendJson(res, 502, { error: "weather_upstream_failed" });
  }
}
