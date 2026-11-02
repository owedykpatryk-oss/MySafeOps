/**
 * Same-origin proxy for two dated NLS Ordnance Survey tile series.
 * The browser cannot read those tiles into a canvas, so the marker is drawn after this proxy.
 * The path is an allowlist: series id, zoom and tile indices only.
 */

import { checkRateLimit, getClientIp, isSameSiteApiRequest } from "./securityUtils.js";
import { nlsTileRequest } from "../src/modules/gprReport/gprHistoricImagery.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    return res.end("method_not_allowed");
  }
  if (!isSameSiteApiRequest(req)) {
    res.statusCode = 403;
    return res.end("forbidden_origin");
  }
  const limit = checkRateLimit(`nls-tile:${getClientIp(req)}`, { max: 40, windowMs: 60_000 });
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.statusCode = 429;
    return res.end("rate_limited");
  }

  const params = new URL(req.url, "https://mysafeops.local").searchParams;
  const request = nlsTileRequest(params.get("series"), params.get("z"), params.get("x"), params.get("y"));
  if (!request) {
    res.statusCode = 400;
    return res.end("tile_not_allowed");
  }

  let upstream;
  try {
    upstream = await fetch(request.upstream);
  } catch {
    res.statusCode = 502;
    return res.end("tile_unreachable");
  }
  if (!upstream.ok) {
    res.statusCode = 502;
    return res.end("tile_unavailable");
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = req.method === "HEAD" ? 200 : 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "HEAD") return res.end();
  return res.end(bytes);
}
