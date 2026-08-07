/**
 * OSRM driving route proxy — site to nearest A&E map overlay.
 * POST /api/osrm-route { fromLat, fromLng, toLat, toLng }
 */

import { API_JSON_HEADERS, isSameSiteApiRequest, parseBoundedJson, readJsonBody, rejectIfRateLimited, sendJson } from "./securityUtils.js";
import { parseLatLng } from "./coordUtils.js";

const UPSTREAM = "https://router.project-osrm.org/route/v1/driving";
const MAX_UPSTREAM_BYTES = 512_000;

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "HEAD") {
    res.setHeader("Allow", "POST, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isSameSiteApiRequest(req)) {
    return sendJson(res, 403, { error: "forbidden_origin" });
  }

  if (rejectIfRateLimited(req, res, "osrm-route", { max: 30, windowMs: 60_000 })) return;

  if (req.method === "HEAD") {
    res.writeHead(204, API_JSON_HEADERS);
    return res.end();
  }

  const body = await readJsonBody(req, 4096);
  if (body === null) return sendJson(res, 400, { error: "invalid_json" });
  if (body?.__body_too_large) return sendJson(res, 413, { error: "payload_too_large" });

  const from = parseLatLng(body?.fromLat ?? body?.lat, body?.fromLng ?? body?.lng);
  const to = parseLatLng(body?.toLat, body?.toLng);
  if (!from || !to) return sendJson(res, 400, { error: "invalid_coordinates" });

  const url = `${UPSTREAM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MySafeOps/1.0 (hospital route proxy; mysafeops.com)",
      },
    });
    const text = await upstream.text();
    const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
    if (parsed.error || !parsed.value) {
      return sendJson(res, 502, { error: "osrm_upstream_invalid" });
    }
    const route = parsed.value?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      return sendJson(res, 404, { error: "no_route" });
    }
    const ring = coords
      .map((c) => (Array.isArray(c) && c.length >= 2 ? [Number(c[1]), Number(c[0])] : null))
      .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (ring.length < 2) return sendJson(res, 404, { error: "no_route" });

    res.writeHead(200, {
      ...API_JSON_HEADERS,
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      "Vary": "Origin",
    });
    return res.end(
      JSON.stringify({
        ring,
        distance_m: route.distance ?? null,
        duration_s: route.duration ?? null,
      })
    );
  } catch {
    return sendJson(res, 502, { error: "osrm_upstream_unreachable" });
  }
}
