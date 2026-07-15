/**
 * Parse and validate imports for Project Drawing Editor (JSON / KML / GPX).
 */

function clampLat(n) {
  return Math.max(-85, Math.min(85, n));
}
function clampLng(n) {
  return Math.max(-180, Math.min(180, n));
}

/** Namespace-safe lookup — Google Earth KML uses the default OGC namespace. */
function elementsByLocalName(root, localName) {
  if (!root) return [];
  try {
    if (typeof root.getElementsByTagNameNS === "function") {
      const ns = root.getElementsByTagNameNS("*", localName);
      if (ns?.length) return Array.from(ns);
    }
  } catch {
    /* ignore */
  }
  try {
    const plain = root.getElementsByTagName?.(localName);
    if (plain?.length) return Array.from(plain);
  } catch {
    /* ignore */
  }
  return [];
}

function firstByLocalName(root, localName) {
  return elementsByLocalName(root, localName)[0] || null;
}

function placemarkName(pm) {
  return firstByLocalName(pm, "name")?.textContent?.trim() || "";
}

/**
 * @returns {{ name: string, lat: number, lng: number }[]}
 */
export function parseKmlPoints(xmlText) {
  const doc = new DOMParser().parseFromString(String(xmlText || ""), "text/xml");
  const err = doc.querySelector("parsererror");
  if (err) return [];
  const placemarks = elementsByLocalName(doc, "Placemark");
  const out = [];
  for (const pm of placemarks) {
    const name = placemarkName(pm);
    const coordEl = firstByLocalName(pm, "coordinates");
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

function parseCoordTriples(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const parts = tok.split(",").map((x) => parseFloat(x.trim()));
      if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
      return { lng: clampLng(parts[0]), lat: clampLat(parts[1]) };
    })
    .filter(Boolean);
}

function ringsClose(a, b, eps = 1e-7) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) <= eps && Math.abs(a.lng - b.lng) <= eps;
}

function ensureClosedRing(ring) {
  if (!ring?.length) return ring || [];
  if (ring.length >= 3 && !ringsClose(ring[0], ring[ring.length - 1])) {
    return [...ring, { lat: ring[0].lat, lng: ring[0].lng }];
  }
  return ring;
}

/** Regex fallback when DOMParser drops namespaced geometry (rare, but seen with Earth exports). */
function parsePolygonsFromKmlTextFallback(xmlText) {
  const text = String(xmlText || "");
  if (!/<Polygon[\s>]/i.test(text)) return [];
  const out = [];
  const polyRe = /<Polygon\b[\s\S]*?<\/Polygon>/gi;
  let m;
  while ((m = polyRe.exec(text))) {
    const block = m[0];
    const coordMatch =
      block.match(/<outerBoundaryIs[\s\S]*?<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i) ||
      block.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (!coordMatch?.[1]) continue;
    const ring = ensureClosedRing(parseCoordTriples(coordMatch[1]));
    if (ring.length >= 3) out.push({ name: "", ring });
  }
  return out;
}

function parentPlacemarkName(el) {
  let n = el?.parentElement || el?.parentNode;
  while (n) {
    const ln = String(n.localName || n.nodeName || "").replace(/^.*:/, "");
    if (ln === "Placemark") return placemarkName(n);
    n = n.parentElement || n.parentNode;
  }
  return "";
}

/**
 * Parse KML polygons, line strings and points from Placemarks.
 * @returns {{ polygons: { name: string, ring: { lat: number, lng: number }[] }[], lineStrings: { name: string, points: { lat: number, lng: number }[] }[], points: { name: string, lat: number, lng: number }[] }}
 */
export function parseKmlGeometry(xmlText) {
  const raw = String(xmlText || "").replace(/^\uFEFF/, "");
  const doc = new DOMParser().parseFromString(raw, "text/xml");
  if (doc.querySelector("parsererror")) {
    return { polygons: [], lineStrings: [], points: [] };
  }
  const polygons = [];
  const lineStrings = [];
  const points = [];

  // Walk every geometry node (handles Folder / Document / MultiGeometry nesting).
  for (const polygonEl of elementsByLocalName(doc, "Polygon")) {
    const coordEl = firstByLocalName(polygonEl, "coordinates");
    const ring = ensureClosedRing(parseCoordTriples(coordEl?.textContent));
    if (ring.length >= 3) {
      polygons.push({ name: parentPlacemarkName(polygonEl), ring });
    }
  }

  for (const lineEl of elementsByLocalName(doc, "LineString")) {
    const coordEl = firstByLocalName(lineEl, "coordinates");
    const pts = parseCoordTriples(coordEl?.textContent);
    if (pts.length >= 2) {
      lineStrings.push({ name: parentPlacemarkName(lineEl), points: pts });
    }
  }

  for (const pointEl of elementsByLocalName(doc, "Point")) {
    const coordEl = firstByLocalName(pointEl, "coordinates");
    const pts = parseCoordTriples(coordEl?.textContent);
    if (pts[0]) {
      points.push({ name: parentPlacemarkName(pointEl), lat: pts[0].lat, lng: pts[0].lng });
    }
  }

  // Closed paths exported as LineString (common from some GIS tools) → site boundary.
  for (const line of lineStrings) {
    const pts = line.points || [];
    if (pts.length >= 3 && ringsClose(pts[0], pts[pts.length - 1])) {
      polygons.push({ name: line.name || "Closed path", ring: ensureClosedRing(pts) });
    }
  }

  if (!polygons.length) {
    for (const p of parsePolygonsFromKmlTextFallback(raw)) {
      polygons.push(p);
    }
  }

  return { polygons, lineStrings, points };
}

/**
 * Build project boundary fields from parsed KML geometry (uses largest polygon).
 */
export function boundaryFromKmlGeometry(geom, { sourceName = "KML import" } = {}) {
  const polys = geom?.polygons || [];
  if (!polys.length) return null;
  const primary =
    polys.reduce((best, p) => (p.ring.length > (best?.ring?.length || 0) ? p : best), polys[0]) || polys[0];
  const features = polys.map((p, idx) => ({
    type: "Feature",
    properties: { name: p.name || `Boundary ${idx + 1}` },
    geometry: {
      type: "Polygon",
      coordinates: [p.ring.map(({ lng, lat }) => [lng, lat])],
    },
  }));
  return {
    boundaryGeoJson: { type: "FeatureCollection", features },
    boundaryPoints: primary.ring.map(({ lat, lng }) => ({ lat, lng })),
    boundarySource: sourceName,
    boundaryName: primary.name || "Site boundary",
  };
}

/** Human hint when import finds geometry but no usable polygon. */
export function describeKmlBoundaryMiss(geom) {
  const polys = geom?.polygons?.length || 0;
  const lines = geom?.lineStrings?.length || 0;
  const pts = geom?.points?.length || 0;
  if (polys > 0) return "";
  if (lines > 0) {
    return `Found ${lines} path(s) but no closed polygon. In Google Earth use Add → Polygon (not Path), or close the path so the first and last points match.`;
  }
  if (pts > 0) {
    return `Found ${pts} point(s) but no polygon boundary. Export a closed site polygon from your survey/GIS.`;
  }
  return "No polygon found in KML — use a closed site boundary.";
}

export function parseGpxPoints(xmlText) {
  const doc = new DOMParser().parseFromString(String(xmlText || ""), "text/xml");
  if (doc.querySelector("parsererror")) return [];
  const wpts = elementsByLocalName(doc, "wpt");
  const out = [];
  for (const w of wpts) {
    const lat = parseFloat(w.getAttribute("lat"));
    const lng = parseFloat(w.getAttribute("lon"));
    const name = firstByLocalName(w, "name")?.textContent?.trim() || "";
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
