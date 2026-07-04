export const LAT_MIN = -90;
export const LAT_MAX = 90;
export const LNG_MIN = -180;
export const LNG_MAX = 180;

export function parseCoord(raw, min, max) {
  const n = parseFloat(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function parseLatLng(latRaw, lngRaw) {
  const lat = parseCoord(latRaw, LAT_MIN, LAT_MAX);
  const lng = parseCoord(lngRaw, LNG_MIN, LNG_MAX);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}
