/**
 * UK postcode lookup via postcodes.io (free, no API key).
 * https://postcodes.io/
 */

function normalisePostcode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export async function lookupUkPostcode(postcode) {
  const pc = normalisePostcode(postcode);
  if (!pc) return null;

  const compact = pc.replace(/\s/g, "");
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;

  const json = await res.json();
  const r = json?.result;
  if (!r) return null;

  return {
    postcode: r.postcode || pc,
    lat: r.latitude,
    lng: r.longitude,
    adminDistrict: r.admin_district || "",
    parish: r.parish || "",
    region: r.region || "",
    country: r.country || "",
  };
}
