/** Zone / area polygon kinds for Project Drawing Editor (aligned with plan markup). */

export const PDE_AREA_KINDS = [
  { id: "exclusion", label: "Exclusion / no-go", color: "#dc2626", fill: "rgba(220,38,38,0.22)" },
  { id: "hazard", label: "Hazard zone", color: "#ea580c", fill: "rgba(234,88,12,0.22)" },
  { id: "work", label: "Work area", color: "#0891b2", fill: "rgba(14,116,144,0.18)" },
  { id: "parking", label: "Parking", color: "#475569", fill: "rgba(71,85,105,0.2)" },
  { id: "muster", label: "Assembly / muster area", color: "#16a34a", fill: "rgba(22,163,74,0.2)" },
  { id: "fire_lane", label: "Fire lane — keep clear", color: "#ca8a04", fill: "rgba(234,179,8,0.22)" },
  { id: "access", label: "Access / egress", color: "#2563eb", fill: "rgba(37,99,235,0.16)" },
  { id: "loading", label: "Loading / delivery bay", color: "#7c3aed", fill: "rgba(124,58,237,0.16)" },
];

const AREA_BY_ID = Object.fromEntries(PDE_AREA_KINDS.map((k) => [k.id, k]));

export function pdeAreaKindMeta(kind) {
  return AREA_BY_ID[kind] || AREA_BY_ID.exclusion;
}

export function isPolygonDrawingObject(row) {
  return Boolean(row && row.geometry === "polygon" && Array.isArray(row.ring) && row.ring.length >= 3);
}

export function ringCentroidPlan(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return { x: 50, y: 50 };
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const p of ring) {
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sx += x;
    sy += y;
    n += 1;
  }
  if (n === 0) return { x: 50, y: 50 };
  return { x: sx / n, y: sy / n };
}

export function ringCentroidGeo(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let sLat = 0;
  let sLng = 0;
  let n = 0;
  for (const p of ring) {
    const lat = Number(p.geoLat ?? p.lat);
    const lng = Number(p.geoLng ?? p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    sLat += lat;
    sLng += lng;
    n += 1;
  }
  if (n === 0) return null;
  return { lat: sLat / n, lng: sLng / n };
}
