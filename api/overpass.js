/**
 * Vercel serverless: OpenStreetMap Overpass proxy for nearest-hospital lookup.
 * POST /api/overpass  { lat, lng, radiusM? }
 * Keeps client CSP on connect-src 'self' — no third-party Overpass host required.
 */

import { API_JSON_HEADERS, isSameSiteApiRequest, parseBoundedJson, readJsonBody, sendJson } from "./securityUtils.js";
import { parseLatLng } from "./coordUtils.js";

const UPSTREAM = "https://overpass-api.de/api/interpreter";
const MAX_UPSTREAM_BYTES = 512_000;
const DEFAULT_RADIUS_M = 25_000;

function clampRadiusM(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_M;
  return Math.max(500, Math.min(50_000, Math.round(n)));
}

function buildHospitalQuery(lat, lng, radiusM) {
  return `
[out:json][timeout:15];
(
  node(around:${radiusM},${lat},${lng})["amenity"="hospital"];
  node(around:${radiusM},${lat},${lng})["healthcare"="hospital"];
);
out body;
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "HEAD") {
    res.setHeader("Allow", "POST, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

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

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "MySafeOps/1.0 (nearest hospital proxy; mysafeops.com)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    const text = await upstream.text();
    const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
    if (parsed.error) {
      return sendJson(res, 502, { error: "overpass_upstream_invalid" });
    }
    res.writeHead(upstream.ok ? 200 : upstream.status, {
      ...API_JSON_HEADERS,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    });
    return res.end(JSON.stringify(parsed.value));
  } catch {
    return sendJson(res, 502, { error: "overpass_upstream_unreachable" });
  }
}
