/**
 * Vercel serverless: BGS OGC API proxy — bedrock & superficial geology at a point.
 * GET /api/geology?lat=51.5&lng=-0.12
 * Keeps client CSP on connect-src 'self'.
 */

import { API_JSON_HEADERS, isSameSiteApiRequest, parseBoundedJson, rejectIfRateLimited, sendJson } from "./securityUtils.js";
import { parseLatLng } from "./coordUtils.js";

const BGS_BASE = "https://ogcapi.bgs.ac.uk/collections";
const MAX_UPSTREAM_BYTES = 256_000;
const BBOX_DELTA = 0.002;

const COLLECTIONS = {
  bedrock: "bgsgeology625kbedrock",
  superficial: "bgsgeology625ksuperficial",
};

function bboxForPoint(lng, lat) {
  return [lng - BBOX_DELTA, lat - BBOX_DELTA, lng + BBOX_DELTA, lat + BBOX_DELTA].join(",");
}

function pickFeatureProps(feature) {
  const p = feature?.properties || {};
  return {
    lex: p.lex || "",
    lexDescription: p.lex_d || "",
    rock: p.rock || "",
    rockDescription: p.rock_d || "",
    rcs: p.rcs || "",
    rcsDescription: p.rcs_d || "",
    maxSystem: p.max_system || "",
    maxEra: p.max_erath || "",
    scale: p.nom_scale || "625000",
    bgsRef: p.bgsref,
  };
}

async function fetchCollectionAtPoint(collectionId, lng, lat) {
  const u = new URL(`${BGS_BASE}/${collectionId}/items`);
  u.searchParams.set("bbox", bboxForPoint(lng, lat));
  u.searchParams.set("limit", "5");
  u.searchParams.set("f", "json");

  const upstream = await fetch(u.toString(), {
    headers: { Accept: "application/geo+json, application/json" },
  });
  const text = await upstream.text();
  const parsed = parseBoundedJson(text, MAX_UPSTREAM_BYTES);
  if (parsed.error || !upstream.ok) {
    return { error: "bgs_upstream_failed", status: upstream.status || 502 };
  }
  const features = parsed.value?.features || [];
  if (!features.length) return { feature: null };
  const feature = features[0];
  return { feature: pickFeatureProps(feature) };
}

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

  const { lat, lng } = coords;

  try {
    const [bedrock, superficial] = await Promise.all([
      fetchCollectionAtPoint(COLLECTIONS.bedrock, lng, lat),
      fetchCollectionAtPoint(COLLECTIONS.superficial, lng, lat),
    ]);

    const payload = {
      lat,
      lng,
      fetchedAt: new Date().toISOString(),
      source: "bgs-ogcapi",
      scale: "1:625,000 (generalised)",
      bedrock: bedrock.feature || null,
      superficial: superficial.feature || null,
    };

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
