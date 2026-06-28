/**
 * UK postcode lookup via postcodes.io (free, no API key).
 * https://postcodes.io/
 */

const UPSTREAM = "https://api.postcodes.io/postcodes";

function normalisePostcode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function mapPostcodeResult(r, fallbackPc) {
  if (!r) return null;
  return {
    postcode: r.postcode || fallbackPc,
    lat: r.latitude,
    lng: r.longitude,
    adminDistrict: r.admin_district || "",
    parish: r.parish || "",
    region: r.region || "",
    country: r.country || "",
  };
}

async function readPostcodeJson(res) {
  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchPostcodeJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = await readPostcodeJson(res);
  return json?.result ? json : null;
}

export async function lookupUkPostcode(postcode) {
  const pc = normalisePostcode(postcode);
  if (!pc) return null;

  const compact = pc.replace(/\s/g, "");
  const proxyUrl = `/api/postcode?code=${encodeURIComponent(compact)}`;
  const directUrl = `${UPSTREAM}/${encodeURIComponent(compact)}`;

  const fromProxy = await fetchPostcodeJson(proxyUrl).catch(() => null);
  if (fromProxy?.result) return mapPostcodeResult(fromProxy.result, pc);

  const fromDirect = await fetchPostcodeJson(directUrl).catch(() => null);
  if (fromDirect?.result) return mapPostcodeResult(fromDirect.result, pc);

  return null;
}
