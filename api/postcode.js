/**
 * Vercel serverless proxy for UK postcode lookup (postcodes.io).
 * GET /api/postcode?code=KT227SH — flat route (reliable on Vercel + Vite dev proxy).
 */

import { parseBoundedJson, isSameSiteApiRequest, rejectIfRateLimited } from "./securityUtils.js";
import { normaliseUkPostcodeCompact, isValidUkPostcodeCompact } from "./postcodeUtils.js";

const UPSTREAM = "https://api.postcodes.io/postcodes";
const MAX_UPSTREAM_BYTES = 32_768;

/** Keep only fields the app uses — postcodes.io returns large census payloads. */
function slimPostcodePayload(value) {
  if (!value?.result) return value;
  const r = value.result;
  return {
    status: value.status,
    result: {
      postcode: r.postcode,
      latitude: r.latitude,
      longitude: r.longitude,
      admin_district: r.admin_district,
      region: r.region,
      country: r.country,
      parish: r.parish,
    },
  };
}

const API_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-site",
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  "Vary": "Origin",
};

function sendJson(res, status, obj) {
  res.writeHead(status, { ...API_JSON_HEADERS, "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  if (rejectIfRateLimited(req, res, "postcode", { max: 60, windowMs: 60_000 })) {
    return;
  }

  const latQuery = req.query?.lat;
  const lngQuery = req.query?.lng ?? req.query?.lon;
  if (latQuery != null || lngQuery != null) {
    const lat = Number(latQuery);
    const lng = Number(lngQuery);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 49 || lat > 61.1 || lng < -8.7 || lng > 2.2) {
      return sendJson(res, 400, { error: "Invalid coordinates" });
    }
    try {
      const upstream = await fetch(
        `${UPSTREAM}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&limit=1&radius=2000`,
        { headers: { Accept: "application/json" } }
      );
      const text = await upstream.text();
      const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
      if (parsed.error) return sendJson(res, 502, { error: "Postcode lookup unavailable" });
      const nearest = Array.isArray(parsed.value?.result) ? parsed.value.result[0] : null;
      if (!nearest?.postcode) return sendJson(res, 404, { error: "Postcode not found" });
      res.writeHead(200, API_JSON_HEADERS);
      res.end(JSON.stringify(slimPostcodePayload({ status: 200, result: nearest })));
      return;
    } catch {
      return sendJson(res, 502, { error: "Postcode lookup unavailable" });
    }
  }

  const raw = String(req.query?.code || req.query?.postcode || "").trim();
  const compact = normaliseUkPostcodeCompact(raw);
  if (!compact || !isValidUkPostcodeCompact(compact)) {
    return sendJson(res, 400, { error: "Invalid UK postcode" });
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/${encodeURIComponent(compact)}`, {
      headers: { Accept: "application/json" },
    });
    const text = await upstream.text();
    const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
    if (parsed.error) {
      return sendJson(res, 502, { error: "Postcode lookup unavailable" });
    }
    res.writeHead(upstream.status, API_JSON_HEADERS);
    res.end(JSON.stringify(slimPostcodePayload(parsed.value)));
  } catch {
    return sendJson(res, 502, { error: "Postcode lookup unavailable" });
  }
}
