/**
 * Server-side BGS geology lookup: prefer DigMap 50k (WMS GetFeatureInfo),
 * plus nearby onshore boreholes; fall back to OGC 625k polygons.
 */
import { pickBestGeologyFeature, BGS_625K_DISCLAIMER } from "./bgsGeologyPick.mjs";

export const BGS_50K_DISCLAIMER =
  "BGS Geology 50k (DigMapGB) is detailed digital geology at ~1:50,000. It is still desk-study mapping — not a site investigation, trial-pit soil log or geotechnical design description.";

export const BGS_POSTCODE_ACCURACY_WARNING =
  "Lookup used a postcode/address centroid, not a project map pin — formation names can be wrong for the true site. Set lat/lng on the project for better accuracy.";

const OGC_BASE = "https://ogcapi.bgs.ac.uk/collections";
const WMS_BASE = "https://map.bgs.ac.uk/arcgis/services/BGS_Detailed_Geology/MapServer/WMSServer";

const WMS_LAYERS = {
  bedrock: "BGS.50k.Bedrock",
  superficial: "BGS.50k.Superficial.deposits",
  artificial: "BGS.50k.Artificial.ground",
  massMovement: "BGS.50k.Mass.movement",
};

const OGC_625K = {
  bedrock: "bgsgeology625kbedrock",
  superficial: "bgsgeology625ksuperficial",
};

const MAX_BYTES = 256_000;

function bboxDelta(delta, lng, lat) {
  return [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
}

function haversineM(lat1, lng1, lat2, lng2) {
  const toR = Math.PI / 180;
  const R = 6371000;
  const dLat = (lat2 - lat1) * toR;
  const dLng = (lng2 - lng1) * toR;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Normalise WMS 50k GeoJSON / OGC 625k properties into a common layer shape. */
export function normalizeGeologyLayerProps(raw = {}, { scaleHint = "" } = {}) {
  const p = raw || {};
  const lexDescription = p.LEX_D || p.lex_d || p.lexDescription || "";
  const rockDescription = p.RCS_D || p.rock_d || p.rockDescription || "";
  const lex = p.LEX || p.lex || "";
  const rock = p.RCS || p.rock || "";
  return {
    lex,
    lexDescription,
    rock,
    rockDescription,
    rcs: rock,
    rcsDescription: rockDescription,
    broadDescription: p.BROAD_D || p.broadDescription || "",
    setting: p.SETTING_D || p.setting || "",
    maxSystem: p.MAX_PERIOD || p.max_system || p.maxSystem || "",
    scale: p.NOM_SCALE || p.nom_scale || scaleHint || "",
    bgsRef: p.BGSREF || p.bgsref || p.bgsRef,
    lexiconUrl: p.LEX_WEB || p.lexiconUrl || "",
    typeDescription: p.TYPE_D || "",
  };
}

function layerHasContent(layer) {
  return Boolean(layer && (layer.lexDescription || layer.rockDescription || layer.lex));
}

async function readJsonResponse(upstream, maxBytes = MAX_BYTES) {
  const text = await upstream.text();
  if (text.length > maxBytes) return { error: "payload_too_large" };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: "invalid_json", text: text.slice(0, 200) };
  }
}

/** WMS 1.3 GetFeatureInfo at point centre of a small CRS:84 bbox. */
export async function fetchWms50kLayer(layerName, lng, lat, { fetchImpl = fetch } = {}) {
  const delta = 0.0008;
  const u = new URL(WMS_BASE);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("VERSION", "1.3.0");
  u.searchParams.set("REQUEST", "GetFeatureInfo");
  u.searchParams.set("LAYERS", layerName);
  u.searchParams.set("QUERY_LAYERS", layerName);
  u.searchParams.set("CRS", "CRS:84");
  u.searchParams.set("BBOX", bboxDelta(delta, lng, lat));
  u.searchParams.set("WIDTH", "101");
  u.searchParams.set("HEIGHT", "101");
  u.searchParams.set("I", "50");
  u.searchParams.set("J", "50");
  u.searchParams.set("INFO_FORMAT", "application/geo+json");
  u.searchParams.set("FEATURE_COUNT", "3");

  const upstream = await fetchImpl(u.toString(), {
    headers: { Accept: "application/geo+json, application/json" },
  });
  if (!upstream.ok) return null;
  const parsed = await readJsonResponse(upstream);
  if (parsed.error) return null;
  const feature = (parsed.value?.features || [])[0];
  if (!feature?.properties) return null;
  return normalizeGeologyLayerProps(feature.properties, { scaleHint: "50000" });
}

async function fetchOgc625kLayer(collectionId, lng, lat, { fetchImpl = fetch } = {}) {
  const u = new URL(`${OGC_BASE}/${collectionId}/items`);
  u.searchParams.set("bbox", bboxDelta(0.002, lng, lat));
  u.searchParams.set("limit", "10");
  u.searchParams.set("f", "json");
  const upstream = await fetchImpl(u.toString(), {
    headers: { Accept: "application/geo+json, application/json" },
  });
  if (!upstream.ok) return null;
  const parsed = await readJsonResponse(upstream);
  if (parsed.error) return null;
  const feature = pickBestGeologyFeature(parsed.value?.features || [], lng, lat);
  if (!feature?.properties) return null;
  return normalizeGeologyLayerProps(feature.properties, { scaleHint: "625000" });
}

/** Nearby onshore borehole index (~350 m). */
export async function fetchNearbyBoreholes(lng, lat, { fetchImpl = fetch, limit = 5, radiusDeg = 0.0035 } = {}) {
  const u = new URL(`${OGC_BASE}/onshoreboreholeindex/items`);
  u.searchParams.set("bbox", bboxDelta(radiusDeg, lng, lat));
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("f", "json");
  const upstream = await fetchImpl(u.toString(), {
    headers: { Accept: "application/geo+json, application/json" },
  });
  if (!upstream.ok) return [];
  const parsed = await readJsonResponse(upstream);
  if (parsed.error) return [];
  const rows = (parsed.value?.features || [])
    .map((f) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates;
      const bLng = Array.isArray(coords) ? Number(coords[0]) : NaN;
      const bLat = Array.isArray(coords) ? Number(coords[1]) : NaN;
      const distanceM =
        Number.isFinite(bLat) && Number.isFinite(bLng) ? Math.round(haversineM(lat, lng, bLat, bLng)) : null;
      return {
        reference: p.reference || "",
        name: p.name || "",
        lengthM: p.length != null ? Number(p.length) : null,
        precision: p.precision || "",
        yearKnown: p.year_known || "",
        scanUrl: p.scan_url || "",
        distanceM,
        lat: Number.isFinite(bLat) ? bLat : null,
        lng: Number.isFinite(bLng) ? bLng : null,
      };
    })
    .filter((r) => r.reference || r.name);
  rows.sort((a, b) => (a.distanceM ?? 9e9) - (b.distanceM ?? 9e9));
  return rows.slice(0, limit);
}

/**
 * Full geology payload for /api/geology.
 * @param {number} lat
 * @param {number} lng
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function fetchBgsGeologyAtPoint(lat, lng, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const [bedrock50, superficial50, artificial50, mass50, boreholes] = await Promise.all([
    fetchWms50kLayer(WMS_LAYERS.bedrock, lng, lat, { fetchImpl }).catch(() => null),
    fetchWms50kLayer(WMS_LAYERS.superficial, lng, lat, { fetchImpl }).catch(() => null),
    fetchWms50kLayer(WMS_LAYERS.artificial, lng, lat, { fetchImpl }).catch(() => null),
    fetchWms50kLayer(WMS_LAYERS.massMovement, lng, lat, { fetchImpl }).catch(() => null),
    fetchNearbyBoreholes(lng, lat, { fetchImpl }).catch(() => []),
  ]);

  const has50k = layerHasContent(bedrock50) || layerHasContent(superficial50) || layerHasContent(artificial50);
  let bedrock = bedrock50;
  let superficial = superficial50;
  let scale = "1:50,000 (DigMapGB)";
  let source = "bgs-wms-50k";
  let disclaimer = BGS_50K_DISCLAIMER;
  let resolution = "50k";

  if (!has50k) {
    const [bedrock625, superficial625] = await Promise.all([
      fetchOgc625kLayer(OGC_625K.bedrock, lng, lat, { fetchImpl }).catch(() => null),
      fetchOgc625kLayer(OGC_625K.superficial, lng, lat, { fetchImpl }).catch(() => null),
    ]);
    bedrock = bedrock625;
    superficial = superficial625;
    scale = "1:625,000 (generalised)";
    source = "bgs-ogcapi-625k";
    disclaimer = BGS_625K_DISCLAIMER;
    resolution = "625k";
  }

  return {
    lat,
    lng,
    fetchedAt: new Date().toISOString(),
    source,
    scale,
    resolution,
    disclaimer,
    bedrock: bedrock || null,
    superficial: superficial || null,
    artificial: artificial50 || null,
    massMovement: mass50 || null,
    nearbyBoreholes: boreholes || [],
  };
}
