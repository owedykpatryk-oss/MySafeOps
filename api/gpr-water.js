/**
 * Same-site desk check for mapped water near a GPR survey point.
 * The query is fixed. Far water is dropped before the response is sent.
 */

import { API_JSON_HEADERS, isSameSiteApiRequest, rejectIfRateLimited, sendJson, readJsonBody } from "./securityUtils.js";
import { parseLatLng } from "./coordUtils.js";
import { fetchOverpass } from "./overpass.js";
import { buildWaterOverpassQuery, summariseWaterElements } from "../src/modules/gprReport/gprWaterProximity.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "HEAD") {
    res.setHeader("Allow", "POST, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!isSameSiteApiRequest(req)) return sendJson(res, 403, { error: "forbidden_origin" });
  if (rejectIfRateLimited(req, res, "gpr-water", { max: 20, windowMs: 60_000 })) return;
  if (req.method === "HEAD") {
    res.writeHead(204, API_JSON_HEADERS);
    return res.end();
  }

  const body = await readJsonBody(req, 1024);
  if (body === null || body?.__body_too_large) return sendJson(res, 400, { error: "invalid_json" });
  const coords = parseLatLng(body?.lat, body?.lng ?? body?.lon);
  if (!coords) return sendJson(res, 400, { error: "invalid_coordinates" });

  const result = await fetchOverpass(buildWaterOverpassQuery(coords.lat, coords.lng));
  if (!result.ok) return sendJson(res, 502, { error: result.error || "overpass_upstream_unreachable" });

  const retrievedAt = new Date().toISOString();
  const nearest = summariseWaterElements(coords.lat, coords.lng, result.value?.elements || []);
  return sendJson(res, 200, {
    ok: true,
    source: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    retrievedAt,
    fresh: nearest.fresh,
    salt: nearest.salt,
  });
}
