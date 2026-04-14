/**
 * Parse and validate imports for Project Drawing Editor (JSON / KML / GPX).
 */

function clampLat(n) {
  return Math.max(-85, Math.min(85, n));
}
function clampLng(n) {
  return Math.max(-180, Math.min(180, n));
}

/**
 * @returns {{ name: string, lat: number, lng: number }[]}
 */
export function parseKmlPoints(xmlText) {
  const doc = new DOMParser().parseFromString(String(xmlText || ""), "text/xml");
  const err = doc.querySelector("parsererror");
  if (err) return [];
  const placemarks = doc.getElementsByTagName("Placemark");
  const out = [];
  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const name = pm.getElementsByTagName("name")[0]?.textContent?.trim() || "";
    const coordEl = pm.getElementsByTagName("coordinates")[0];
    if (!coordEl) continue;
    const parts = String(coordEl.textContent || "")
      .trim()
      .split(/[\s\n,]+/)
      .filter(Boolean);
    if (parts.length < 2) continue;
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ name, lat: clampLat(lat), lng: clampLng(lng) });
  }
  return out;
}

/**
 * @returns {{ name: string, lat: number, lng: number }[]}
 */
/**
 * GeoJSON FeatureCollection or single Feature with Point geometry.
 * @returns {{ name: string, lat: number, lng: number, type?: string, label?: string }[]}
 */
export function parseGeoJsonPoints(text) {
  let data;
  try {
    data = JSON.parse(String(text || ""));
  } catch {
    return [];
  }
  const out = [];
  const pushFeature = (f) => {
    if (!f || f.type !== "Feature" || !f.geometry || f.geometry.type !== "Point") return;
    const coords = f.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const lng = parseFloat(coords[0]);
    const lat = parseFloat(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const props = f.properties && typeof f.properties === "object" ? f.properties : {};
    const name = String(props.name ?? props.label ?? props.title ?? "").trim();
    const label = props.label != null ? String(props.label).trim() : "";
    const typ = props.objectType != null ? String(props.objectType) : props.type != null ? String(props.type) : "";
    out.push({
      name,
      lat: clampLat(lat),
      lng: clampLng(lng),
      ...(typ ? { type: typ } : {}),
      ...(label ? { label } : {}),
    });
  };

  if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
    for (const f of data.features) pushFeature(f);
    return out;
  }
  if (data?.type === "Feature") {
    pushFeature(data);
  }
  return out;
}

export function parseGpxPoints(xmlText) {
  const doc = new DOMParser().parseFromString(String(xmlText || ""), "text/xml");
  if (doc.querySelector("parsererror")) return [];
  const wpts = doc.getElementsByTagName("wpt");
  const out = [];
  for (let i = 0; i < wpts.length; i++) {
    const w = wpts[i];
    const lat = parseFloat(w.getAttribute("lat"));
    const lng = parseFloat(w.getAttribute("lon"));
    const name = w.getElementsByTagName("name")[0]?.textContent?.trim() || "";
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ name, lat: clampLat(lat), lng: clampLng(lng) });
  }
  return out;
}

/**
 * @param {*} parsed — result of JSON.parse
 * @returns {{ ok: boolean, errors: string[], objects: object[] }}
 */
export function validateDrawingImportJson(parsed) {
  const errors = [];
  if (parsed == null || (typeof parsed !== "object" && !Array.isArray(parsed))) {
    return { ok: false, errors: ["Root must be a JSON object or array."], objects: [] };
  }
  const arr = Array.isArray(parsed.objects)
    ? parsed.objects
    : Array.isArray(parsed)
      ? parsed
      : null;
  if (!arr) {
    return {
      ok: false,
      errors: ['Use either { "version": 1, "objects": [ ... ] } or a top-level array of objects.'],
      objects: [],
    };
  }
  if (arr.length === 0) {
    return { ok: false, errors: ["The objects array is empty."], objects: [] };
  }
  if (arr.length > 1500) {
    errors.push(`Too many objects (${arr.length}); maximum is 1500.`);
  }

  arr.forEach((raw, i) => {
    const prefix = `objects[${i}]`;
    if (!raw || typeof raw !== "object") {
      errors.push(`${prefix}: must be an object.`);
      return;
    }
    const placement = raw.placement === "map" ? "map" : "plan";
    if (raw.x != null && !Number.isFinite(Number(raw.x))) errors.push(`${prefix}: x must be a number.`);
    if (raw.y != null && !Number.isFinite(Number(raw.y))) errors.push(`${prefix}: y must be a number.`);
    if (placement === "map") {
      if (raw.geoLat != null && !Number.isFinite(Number(raw.geoLat))) errors.push(`${prefix}: geoLat must be a number.`);
      if (raw.geoLng != null && !Number.isFinite(Number(raw.geoLng))) errors.push(`${prefix}: geoLng must be a number.`);
    }
    if (raw.type != null && typeof raw.type !== "string") errors.push(`${prefix}: type must be a string.`);
  });

  return {
    ok: errors.length === 0 && arr.length <= 1500,
    errors,
    objects: arr.slice(0, 1500),
  };
}
