/**
 * Vercel serverless: BGS geology at a point (50k WMS preferred, 625k fallback + boreholes).
 * GET /api/geology?lat=51.5&lng=-0.12
 */

import { API_JSON_HEADERS, isSameSiteApiRequest, rejectIfRateLimited, sendJson } from "./securityUtils.js";
import { parseLatLng } from "./coordUtils.js";
import { fetchBgsGeologyAtPoint } from "../shared/bgsGeologyFetch.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  if (rejectIfRateLimited(req, res, "geology", { max: 30, windowMs: 60_000 })) return;

  const coords = parseLatLng(req.query?.lat, req.query?.lng ?? req.query?.lon);
  if (!coords) return sendJson(res, 400, { error: "invalid_coordinates" });

  try {
    const payload = await fetchBgsGeologyAtPoint(coords.lat, coords.lng);
    res.writeHead(200, {
      ...API_JSON_HEADERS,
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    });
    if (req.method === "HEAD") return res.end();
    return res.end(JSON.stringify(payload));
  } catch {
    return sendJson(res, 502, { error: "geology_upstream_unreachable" });
  }
}
