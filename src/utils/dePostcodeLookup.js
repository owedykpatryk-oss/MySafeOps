/**
 * German postcode lookup (5 digits) via server proxy → Nominatim.
 */

const PROXY_PATH = "/api/de-postcode";

/** @param {string} raw */
export function normalizeDePostcode(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 5) return null;
  return digits;
}

/** @param {string} postcode @param {...string} extraText */
export function resolveDePostcodeInput(postcode, ...extraText) {
  const parts = [postcode, ...extraText].map((s) => String(s || "").trim()).filter(Boolean);
  const joined = parts.join(" ");
  const normalized = normalizeDePostcode(joined);
  if (normalized) return normalized;
  const fromParts = normalizeDePostcode(parts.join(""));
  return fromParts || joined;
}

/**
 * @param {string} postcode
 * @returns {Promise<{ lat: number; lng: number; postcode: string; adminDistrict?: string; region?: string; country?: string } | null>}
 */
export async function lookupDePostcode(postcode) {
  const pc = normalizeDePostcode(postcode);
  if (!pc) return null;
  const proxyUrl = `${PROXY_PATH}?code=${encodeURIComponent(pc)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) return null;
  const row = await res.json();
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    postcode: row.postcode || pc,
    adminDistrict: row.adminDistrict || row.city || "",
    region: row.region || row.state || "",
    country: row.country || "Germany",
  };
}
