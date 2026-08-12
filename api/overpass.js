/**
 * Vercel serverless: OpenStreetMap Overpass proxy for nearest-hospital lookup.
 * POST /api/overpass  { lat, lng, radiusM? }
 * Keeps client CSP on connect-src 'self' — no third-party Overpass host required.
 */

import { API_JSON_HEADERS, isSameSiteApiRequest, parseBoundedJson, readJsonBody, rejectIfRateLimited, sendJson } from "./securityUtils.js";
import { parseLatLng } from "./coordUtils.js";
import { buildHospitalQuery } from "../src/utils/hospitalOverpassQuery.js";

const UPSTREAMS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
const MAX_UPSTREAM_BYTES = 512_000;
const DEFAULT_RADIUS_M = 25_000;
const UPSTREAM_TIMEOUT_MS = 22_000;

function clampRadiusM(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_M;
  return Math.max(500, Math.min(50_000, Math.round(n)));
}

async function fetchOverpass(query) {
  const body = `data=${encodeURIComponent(query)}`;
  let lastError = "overpass_upstream_unreachable";

  for (const url of UPSTREAMS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "MySafeOps/1.0 (nearest hospital proxy; mysafeops.com)",
        },
        body,
        signal: controller.signal,
      });
      const text = await upstream.text();
      const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
      if (parsed.error) {
        lastError = "overpass_upstream_invalid";
        continue;
      }
      if (!upstream.ok) {
        lastError = `overpass_http_${upstream.status}`;
        continue;
      }
      // Remap Overpass "remark" errors (rate limit) to next mirror
      if (parsed.value?.remark && /rate.?limit|too many|bandwidth/i.test(String(parsed.value.remark))) {
        lastError = "overpass_rate_limited";
        continue;
      }
      return { ok: true, value: parsed.value };
    } catch {
      lastError = "overpass_upstream_unreachable";
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: lastError };
}

/** Nominatim amenity search — used when every Overpass mirror fails. */
async function fetchNominatimHospitals(lat, lng) {
  const delta = 0.35;
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("amenity", "hospital");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "12");
  u.searchParams.set("addressdetails", "0");
  u.searchParams.set("viewbox", `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
  u.searchParams.set("bounded", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "MySafeOps/1.0 (nearest hospital fallback; mysafeops.com)",
      },
      signal: controller.signal,
    });
    if (!upstream.ok) return null;
    const rows = await upstream.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const elements = rows
      .map((row) => {
        const la = Number(row.lat);
        const lo = Number(row.lon);
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
        const name = String(row.name || row.display_name || "Hospital").split(",")[0].trim() || "Hospital";
        return {
          type: "node",
          lat: la,
          lon: lo,
          tags: { amenity: "hospital", name },
        };
      })
      .filter(Boolean);
    return elements.length ? { elements } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "HEAD") {
    res.setHeader("Allow", "POST, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  if (rejectIfRateLimited(req, res, "overpass", { max: 20, windowMs: 60_000 })) return;

  if (req.method === "HEAD") {
    res.writeHead(204, API_JSON_HEADERS);
    return res.end();
  }

  const body = await readJsonBody(req, 4096);
  if (body === null) return sendJson(res, 400, { error: "invalid_json" });
  if (body?.__body_too_large) return sendJson(res, 413, { error: "payload_too_large" });

  const coords = parseLatLng(body?.lat, body?.lng ?? body?.lon);
  if (!coords) return sendJson(res, 400, { error: "invalid_coordinates" });

  const radiusM = clampRadiusM(body?.radiusM ?? body?.radius);
  const query = buildHospitalQuery(coords.lat, coords.lng, radiusM);

  const result = await fetchOverpass(query);
  if (result.ok) {
    res.writeHead(200, {
      ...API_JSON_HEADERS,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      "Vary": "Origin",
      "X-Hospital-Source": "overpass",
    });
    return res.end(JSON.stringify(result.value));
  }

  const fallback = await fetchNominatimHospitals(coords.lat, coords.lng);
  if (fallback) {
    res.writeHead(200, {
      ...API_JSON_HEADERS,
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      "Vary": "Origin",
      "X-Hospital-Source": "nominatim",
    });
    return res.end(JSON.stringify(fallback));
  }

  return sendJson(res, 502, { error: result.error || "overpass_upstream_unreachable" });
}
