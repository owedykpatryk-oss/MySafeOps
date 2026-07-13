/**
 * Australian postcode lookup (4-digit) via server proxy → Nominatim.
 */

const AU_POSTCODE_IN_TEXT = /\b(\d{4})\b/;

/** @param {string} raw */
export function normaliseAuPostcodeInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 4) return "";
  const n = Number(digits);
  if (n < 800 || n > 9999) return "";
  return digits;
}

/** @param {string} text */
export function extractAuPostcode(text) {
  const m = String(text || "").match(AU_POSTCODE_IN_TEXT);
  return m ? normaliseAuPostcodeInput(m[1]) : "";
}

/** @param {string} postcode @param {...string} extraText */
export function resolveAuPostcodeInput(postcode, ...extraText) {
  const direct = normaliseAuPostcodeInput(postcode);
  if (direct) return direct;
  for (const chunk of extraText) {
    const found = extractAuPostcode(chunk);
    if (found) return found;
  }
  return "";
}

function mapAuResult(row, fallbackPc) {
  if (!row) return null;
  const lat = Number(row.latitude ?? row.lat);
  const lng = Number(row.longitude ?? row.lng ?? row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    postcode: row.postcode || fallbackPc,
    lat,
    lng,
    adminDistrict: row.locality || row.adminDistrict || "",
    parish: "",
    region: row.state || row.region || "",
    country: row.country || "Australia",
  };
}

export async function lookupAuPostcode(postcode) {
  const pc = normaliseAuPostcodeInput(postcode);
  if (!pc) return null;

  const proxyUrl = `/api/au-postcode?code=${encodeURIComponent(pc)}`;
  try {
    const res = await fetch(proxyUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.result) return mapAuResult(json.result, pc);
  } catch {
    return null;
  }
  return null;
}
