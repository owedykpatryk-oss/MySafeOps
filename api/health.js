/**
 * Lightweight liveness probe for status page and uptime checks.
 * GET /api/health → { ok: true, ts }
 */

const API_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-site",
  "Cache-Control": "no-store",
};

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, API_JSON_HEADERS);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  res.writeHead(200, API_JSON_HEADERS);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(JSON.stringify({ ok: true, ts: Date.now() }));
}
