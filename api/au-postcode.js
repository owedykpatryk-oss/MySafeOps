/**
 * Vercel serverless proxy for AU postcode → lat/lng (Nominatim, Australia only).
 * GET /api/au-postcode?code=2000
 */

import { parseBoundedJson, isSameSiteApiRequest, rejectIfRateLimited } from "./securityUtils.js";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const MAX_UPSTREAM_BYTES = 65_536;
const USER_AGENT = "MySafeOps/1.0 (AU construction safety; support@mysafeops.com)";

const API_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-site",
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

function sendJson(res, status, obj) {
  res.writeHead(status, { ...API_JSON_HEADERS, "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function isValidAuPostcode(code) {
  if (!/^\d{4}$/.test(code)) return false;
  const n = Number(code);
  return n >= 800 && n <= 9999;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  if (rejectIfRateLimited(req, res, "au-postcode", { max: 30, windowMs: 60_000 })) {
    return;
  }

  const code = String(req.query?.code || req.query?.postcode || "").replace(/\D/g, "");
  if (!isValidAuPostcode(code)) {
    return sendJson(res, 400, { error: "Invalid Australian postcode (4 digits)" });
  }

  try {
    const url = new URL(NOMINATIM);
    url.searchParams.set("postalcode", code);
    url.searchParams.set("country", "Australia");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const upstream = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    const text = await upstream.text();
    const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
    if (parsed.error) {
      return sendJson(res, 502, { error: "Postcode lookup unavailable" });
    }

    const row = Array.isArray(parsed.value) ? parsed.value[0] : null;
    if (!row?.lat || !row?.lon) {
      return sendJson(res, 404, { error: "Postcode not found" });
    }

    const address = row.address || {};
    const payload = {
      status: 200,
      result: {
        postcode: code,
        latitude: Number(row.lat),
        longitude: Number(row.lon),
        locality: address.city || address.town || address.suburb || address.village || "",
        state: address.state || "",
        country: address.country || "Australia",
      },
    };

    res.writeHead(200, API_JSON_HEADERS);
    res.end(JSON.stringify(payload));
  } catch {
    return sendJson(res, 502, { error: "Postcode lookup unavailable" });
  }
}
