/**
 * Vercel serverless proxy for UK postcode lookup (postcodes.io).
 * GET /api/postcode?code=KT227SH — flat route (reliable on Vercel + Vite dev proxy).
 */

import { parseBoundedJson } from "./securityUtils.js";

const UPSTREAM = "https://api.postcodes.io/postcodes";
const POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/i;
const MAX_UPSTREAM_BYTES = 32_768;

function normaliseCompact(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

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

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const raw = String(req.query?.code || req.query?.postcode || "").trim();
  const compact = normaliseCompact(raw);
  if (!compact || !POSTCODE_RE.test(compact)) {
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
    res.end(JSON.stringify(parsed.value));
  } catch {
    return sendJson(res, 502, { error: "Postcode lookup unavailable" });
  }
}
