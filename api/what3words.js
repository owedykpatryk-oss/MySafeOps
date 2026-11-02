/**
 * Same-site What3Words convert. The API key stays on the server.
 * Words are checked before the upstream call.
 */

import { API_JSON_HEADERS, isSameSiteApiRequest, rejectIfRateLimited, sendJson, readJsonBody } from "./securityUtils.js";
import { normaliseWhat3Words } from "../src/utils/britishNationalGrid.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "HEAD") {
    res.setHeader("Allow", "POST, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!isSameSiteApiRequest(req)) return sendJson(res, 403, { error: "forbidden_origin" });
  if (rejectIfRateLimited(req, res, "what3words", { max: 20, windowMs: 60_000 })) return;
  if (req.method === "HEAD") {
    res.writeHead(204, API_JSON_HEADERS);
    return res.end();
  }

  const body = await readJsonBody(req, 512);
  if (body === null || body?.__body_too_large) return sendJson(res, 400, { error: "invalid_json" });
  const words = normaliseWhat3Words(body?.words);
  if (!words) return sendJson(res, 400, { error: "invalid_words" });

  const key = String(process.env.WHAT3WORDS_API_KEY || "").trim();
  if (!key) return sendJson(res, 503, { error: "what3words_not_configured" });

  const url = new URL("https://api.what3words.com/v3/convert-to-coordinates");
  url.searchParams.set("words", words);
  url.searchParams.set("key", key);
  let upstream;
  try {
    upstream = await fetch(url);
  } catch {
    return sendJson(res, 502, { error: "what3words_unreachable" });
  }
  const payload = await upstream.json().catch(() => null);
  const lat = Number(payload?.coordinates?.lat);
  const lng = Number(payload?.coordinates?.lng);
  if (!upstream.ok || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return sendJson(res, 404, { error: "words_not_found" });
  }
  return sendJson(res, 200, {
    ok: true,
    words: payload.words || words,
    lat,
    lng,
    nearestPlace: String(payload.nearestPlace || ""),
    source: "what3words",
  });
}
