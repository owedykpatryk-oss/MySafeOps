import { sendJson, readJsonBody, isSameSiteApiRequest, checkRateLimit } from "./securityUtils.js";
import { parseBearerToken, verifySupabaseAccessToken } from "./verifySupabaseAuth.js";
import { normaliseForecast } from "../src/modules/droneOperations/droneWeather.js";
import { pointInRegion } from "../src/modules/droneOperations/droneRegions.js";

const cache = new Map();
export function validateWeatherRequest(body, now = Date.now()) {
  if (
    !body ||
    JSON.stringify(body).length > 8000 ||
    !Array.isArray(body.points) ||
    !body.points.length ||
    body.points.length > 3
  )
    throw new Error("Supply 1–3 representative WGS84 points.");
  if (
    body.points.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some((v) => !Number.isFinite(v)) ||
        !pointInRegion(p, body.regionCode || "uk")
    )
  )
    throw new Error("Coordinates must be inside the selected supported UK or Australian region.");
  const start = Date.parse(body.start),
    end = Date.parse(body.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86400000)
    throw new Error("Invalid mission window.");
  if (start < now - 3600000 || end > now + 15 * 86400000)
    return {
      status: "unavailable",
      message: "Forecast not yet available for this window, or the window is in the past.",
    };
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(body.orgSlug || "") ||
    !/^(main|country:[0-9a-fA-F-]{36}:main)$/.test(body.dataKey || "")
  )
    throw new Error("Invalid organisation scope.");
  return { status: "valid" };
}
async function authorisedScope(token, body) {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const response = await fetch(`${url}/rest/v1/rpc/user_can_write_org_country_kv`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_org_slug: body.orgSlug, p_namespace: "mysafeops_projects", p_data_key: body.dataKey }),
    signal: AbortSignal.timeout(8000),
  });
  return response.ok && (await response.json()) === true;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  if (!isSameSiteApiRequest(req)) return sendJson(res, 403, { error: "forbidden_origin" });
  try {
    const token = parseBearerToken(req),
      user = token ? await verifySupabaseAccessToken(token) : null;
    if (!user) return sendJson(res, 401, { error: "Sign in to request weather." });
    const body = await readJsonBody(req, 8000);
    let validation;
    try {
      validation = validateWeatherRequest(body);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
    if (!(await authorisedScope(token, body)))
      return sendJson(res, 403, { error: "Organisation membership, role or billing does not permit this request." });
    if (validation.status !== "valid") return sendJson(res, 200, validation);
    const apiKey = process.env.DRONE_OPEN_METEO_API_KEY;
    if (!apiKey || process.env.DRONE_WEATHER_COMMERCIAL_LICENSE_CONFIRMED !== "true")
      return sendJson(res, 503, {
        status: "not_connected",
        message: "Not connected — configure a commercial Open-Meteo licence and server API key.",
      });
    const limit = checkRateLimit(`drone-weather:${body.orgSlug}:${user.id}`, { max: 6, windowMs: 60000 });
    if (!limit.allowed) return sendJson(res, 429, { error: "Weather request limit reached. Try again later." });
    const cacheKey = JSON.stringify([
      body.orgSlug,
      body.dataKey,
      body.regionCode || "uk",
      body.points,
      body.start,
      body.end,
    ]);
    const cached = cache.get(cacheKey);
    if (cached && Date.parse(cached.validUntil) > Date.now()) return sendJson(res, 200, cached);
    // Per-instance ceiling is a secondary guard; provider account quota is the global budget.
    const cap = Math.min(1000, Math.max(1, Number(process.env.DRONE_WEATHER_INSTANCE_DAILY_LIMIT) || 100));
    const url = new URL("https://customer-api.open-meteo.com/v1/forecast");
    for (const [k, v] of Object.entries({
      latitude: body.points.map((p) => p[1]).join(","),
      longitude: body.points.map((p) => p[0]).join(","),
      hourly:
        "temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,precipitation_probability,visibility,cloud_cover",
      daily: "sunrise,sunset",
      wind_speed_unit: "ms",
      timezone: "UTC",
      timeformat: "unixtime",
      forecast_days: "16",
      apikey: apiKey,
    }))
      url.searchParams.set(k, v);
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!checkRateLimit("drone-weather-provider-budget", { max: cap, windowMs: 86400000 }).allowed)
        return sendJson(res, 429, {
          error: "Weather provider budget reached. Use manual evidence or contact your administrator.",
        });
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (response.ok || response.status < 500) break;
      } catch {
        if (attempt === 1) throw new Error("provider_unavailable");
      }
    }
    if (!response?.ok)
      return sendJson(res, 502, { error: "Weather provider unavailable. No fallback source was used." });
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > 1000000) throw new Error("provider_response_too_large");
    const text = await response.text();
    if (text.length > 1000000) throw new Error("provider_response_too_large");
    const forecast = normaliseForecast(JSON.parse(text), body.points);
    const from = Math.floor(Date.parse(body.start) / 3600000) * 3600000,
      to = Date.parse(body.end);
    for (const point of forecast.points) {
      point.hours = point.hours.filter((h) => Date.parse(h.at) >= from && Date.parse(h.at) < to);
      if (point.hours.length !== Math.ceil((to - from) / 3600000))
        return sendJson(res, 200, {
          status: "unavailable",
          message: "Forecast not yet available for the full operating window.",
        });
    }
    const data = {
      ...forecast,
      status: "available",
      source: "Open-Meteo commercial API / contributing weather providers",
      model: "best_match (provider-selected; exact model run not supplied)",
      fetchedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 15 * 60000).toISOString(),
      attribution: "Open-Meteo, CC BY 4.0",
      warningCoverage: "Not connected",
      heightReference: "Wind and gusts at 10 m above ground",
    };
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, data);
    return sendJson(res, 200, data);
  } catch {
    return sendJson(res, 502, { error: "Weather check failed. No result has been marked as checked." });
  }
}
