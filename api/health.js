/**
 * Lightweight liveness probe for status page and uptime checks.
 * GET /api/health → { ok: true, ts }
 */

import { API_JSON_HEADERS, rejectIfRateLimited, sendJson } from "./securityUtils.js";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (rejectIfRateLimited(req, res, "health", { max: 120, windowMs: 60_000 })) return;

  if (req.method === "HEAD") {
    res.writeHead(200, API_JSON_HEADERS);
    return res.end();
  }

  return sendJson(res, 200, { ok: true, ts: Date.now() });
}
