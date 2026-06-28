/**
 * Vercel serverless proxy for UK postcode lookup (postcodes.io).
 * Same-origin `/api/postcode/*` avoids CSP connect-src issues in the browser.
 */

const UPSTREAM = "https://api.postcodes.io/postcodes";
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

const API_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

function sendJson(res, status, obj) {
  res.writeHead(status, API_JSON_HEADERS);
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const raw = String(req.query?.postcode || "").trim();
  const compact = raw.replace(/\s/g, "").toUpperCase();
  if (!compact || !POSTCODE_RE.test(compact)) {
    sendJson(res, 400, { error: "Invalid UK postcode" });
    return;
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/${encodeURIComponent(compact)}`, {
      headers: { Accept: "application/json" },
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, API_JSON_HEADERS);
    res.end(text);
  } catch {
    sendJson(res, 502, { error: "Postcode lookup unavailable" });
  }
}
