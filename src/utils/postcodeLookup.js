/**
 * UK postcode lookup via postcodes.io (free, no API key).
 * https://postcodes.io/
 */

import { appApiUrl } from "./appApiUrl";

const UPSTREAM = "https://api.postcodes.io/postcodes";
const UK_POSTCODE_IN_TEXT =
  /[A-Z]{1,2}\d{1,2}[A-Z]?(?:\s*|\s*-\s*)\d[A-Z]{2}/i;

/** Strip to letters/digits, format as "OUTWARD INWARD" (e.g. KT22 7SH). */
export function normaliseUkPostcodeInput(raw) {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 5 || cleaned.length > 7) return "";
  const inward = cleaned.slice(-3);
  const outward = cleaned.slice(0, -3);
  if (!outward || inward.length !== 3) return "";
  return `${outward} ${inward}`;
}

/** Find the first UK postcode in free text (address line, site name, etc.). */
export function extractUkPostcode(text) {
  const match = String(text || "").match(UK_POSTCODE_IN_TEXT);
  return match ? normaliseUkPostcodeInput(match[0]) : "";
}

/** Prefer dedicated field, then address / site text. */
export function resolveUkPostcodeInput(postcode, ...extraText) {
  const direct = normaliseUkPostcodeInput(postcode);
  if (direct) return direct;
  for (const chunk of extraText) {
    const found = extractUkPostcode(chunk);
    if (found) return found;
  }
  return "";
}

function mapPostcodeResult(r, fallbackPc) {
  if (!r) return null;
  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    postcode: r.postcode || fallbackPc,
    lat,
    lng,
    adminDistrict: r.admin_district || "",
    parish: r.parish || "",
    region: r.region || "",
    country: r.country || "",
  };
}

async function readPostcodeJson(res) {
  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  if (!text.trim()) return null;
  if (!ct.includes("application/json") && text.trimStart().startsWith("<")) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchPostcodeJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "same-origin",
  });
  const json = await readPostcodeJson(res);
  // A JSON 404 from the proxy means the postcode itself is unknown/retired.
  // Do not retry the legacy route with the same value and duplicate the error.
  if (!res.ok) {
    if (res.status === 404 && (json?.error === "Postcode not found" || json?.terminated)) {
      return { postcodeNotFound: true };
    }
    return null;
  }
  return json?.result ? json : null;
}

async function fetchPostcodeBulk(compact) {
  const res = await fetch(UPSTREAM, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ postcodes: [compact] }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const json = await readPostcodeJson(res);
  const row = Array.isArray(json?.result) ? json.result[0] : null;
  return row?.result ? { result: row.result } : null;
}

export async function lookupUkPostcode(postcode) {
  const pc = normaliseUkPostcodeInput(postcode);
  if (!pc) return null;

  const compact = pc.replace(/\s/g, "");
  const proxyUrl = appApiUrl(`/api/postcode?code=${encodeURIComponent(compact)}`);
  const legacyProxyUrl = appApiUrl(`/api/postcode/${encodeURIComponent(compact)}`);
  const directUrl = `${UPSTREAM}/${encodeURIComponent(compact)}`;

  const fromProxy = await fetchPostcodeJson(proxyUrl).catch(() => null);
  if (fromProxy?.result) return mapPostcodeResult(fromProxy.result, pc);
  if (fromProxy?.postcodeNotFound) return null;

  const fromLegacyProxy = await fetchPostcodeJson(legacyProxyUrl).catch(() => null);
  if (fromLegacyProxy?.result) return mapPostcodeResult(fromLegacyProxy.result, pc);
  if (fromLegacyProxy?.postcodeNotFound) return null;

  if (import.meta.env.PROD) return null;

  const fromDirect = await fetchPostcodeJson(directUrl).catch(() => null);
  if (fromDirect?.result) return mapPostcodeResult(fromDirect.result, pc);

  const fromBulk = await fetchPostcodeBulk(compact).catch(() => null);
  if (fromBulk?.result) return mapPostcodeResult(fromBulk.result, pc);

  return null;
}

/** Nearest UK postcode for a WGS84 point (postcodes.io via /api/postcode). */
export async function reverseUkPostcode(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  const url = appApiUrl(`/api/postcode?lat=${encodeURIComponent(la)}&lng=${encodeURIComponent(lo)}`);
  const json = await fetchPostcodeJson(url).catch(() => null);
  if (!json?.result) return null;
  return mapPostcodeResult(json.result, json.result.postcode);
}
