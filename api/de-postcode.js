/**
 * Vercel serverless proxy for DE postcode → lat/lng (Nominatim, Germany only).
 * GET /api/de-postcode?code=10115
 */

import { parseBoundedJson, isSameSiteApiRequest, rejectIfRateLimited } from "./securityUtils.js";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const MAX_UPSTREAM_BYTES = 65_536;
const USER_AGENT = "MySafeOps/1.0 (DE construction safety; support@mysafeops.com)";

const API_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-site",
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  Vary: "Origin",
};

function sendJson(res, status, obj) {
  res.writeHead(status, { ...API_JSON_HEADERS, "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function normalizeDePostcode(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 5) return null;
  return digits;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  if (rejectIfRateLimited(req, res, "de-postcode", { max: 30, windowMs: 60_000 })) {
    return;
  }

  const code = normalizeDePostcode(String(req.query?.code || req.query?.postcode || ""));
  if (!code) {
    return sendJson(res, 400, { error: "Invalid German postcode (5 digits)" });
  }

  try {
    const url = new URL(NOMINATIM);
    url.searchParams.set("postalcode", code);
    url.searchParams.set("country", "Germany");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const upstream = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!upstream.ok) {
      return sendJson(res, 502, { error: "Postcode lookup failed" });
    }

    const text = await upstream.text();
    const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
    if (parsed.error) {
      return sendJson(res, 502, { error: "Postcode lookup failed" });
    }
    const rows = Array.isArray(parsed.value) ? parsed.value : [];
    const hit = rows[0] || null;
    if (!hit?.lat || !hit?.lon) {
      return sendJson(res, 404, { error: "Postcode not found" });
    }

    const address = hit.address || {};
    return sendJson(res, 200, {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      postcode: address.postcode || code,
      city: address.city || address.town || address.village || "",
      adminDistrict: address.city || address.county || "",
      region: address.state || "",
      country: address.country || "Germany",
    });
  } catch {
    return sendJson(res, 502, { error: "Postcode lookup failed" });
  }
}
