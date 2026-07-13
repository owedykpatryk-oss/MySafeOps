/** Shared UK postcode normalisation for serverless API routes. */

export const UK_POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/i;

export function normaliseUkPostcodeCompact(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidUkPostcodeCompact(compact) {
  return Boolean(compact && UK_POSTCODE_RE.test(compact));
}

const POSTCODES_IO = "https://api.postcodes.io/postcodes";

/** @returns {{ lat: number, lng: number, postcode: string } | null} */
export async function lookupUkPostcodeCoords(compact) {
  const code = normaliseUkPostcodeCompact(compact);
  if (!isValidUkPostcodeCompact(code)) return null;
  try {
    const res = await fetch(`${POSTCODES_IO}/${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.result;
    const lat = Number(r?.latitude);
    const lng = Number(r?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, postcode: r?.postcode || code };
  } catch {
    return null;
  }
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_UA = "MySafeOps/1.0 (AU construction safety; support@mysafeops.com)";

export function isValidAuPostcodeDigits(code) {
  if (!/^\d{4}$/.test(code)) return false;
  const n = Number(code);
  return n >= 800 && n <= 9999;
}

/** @returns {{ lat: number, lng: number, postcode: string } | null} */
export async function lookupAuPostcodeCoords(raw) {
  const code = String(raw || "").replace(/\D/g, "");
  if (!isValidAuPostcodeDigits(code)) return null;
  try {
    const url = new URL(NOMINATIM);
    url.searchParams.set("postalcode", code);
    url.searchParams.set("country", "Australia");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    const lat = Number(row?.lat);
    const lng = Number(row?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, postcode: code };
  } catch {
    return null;
  }
}
