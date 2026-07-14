import { loadOrgScoped as load, saveOrgScoped as save, asStorageArray } from "../../utils/orgStorage";

const PROJECT_DRAWING_OBJECTS_KEY = "project_drawing_objects_v1";
const MAX_OBJECTS = 1500;

export const PROJECT_DRAWING_OBJECT_TYPES = [
  { id: "zone", label: "Zone", color: "#0C447C", shape: "circle", short: "Z", category: "general" },
  { id: "excavation", label: "Excavation", color: "#7C2D12", shape: "diamond", short: "X", category: "general" },
  { id: "work_area", label: "Work area", color: "#0891b2", shape: "square", short: "W", category: "general" },
  { id: "exclusion", label: "Exclusion / no-go", color: "#dc2626", shape: "square", short: "!", category: "general" },
  { id: "fire_exit", label: "Fire exit", color: "#166534", shape: "square", short: "E", category: "safety" },
  { id: "master_point", label: "Muster / assembly point", color: "#7E22CE", shape: "star", short: "M", category: "safety" },
  { id: "fire_extinguisher", label: "Fire extinguisher", color: "#b91c1c", shape: "circle", short: "F", category: "safety" },
  { id: "first_aid", label: "First aid", color: "#c2410c", shape: "circle", short: "+", category: "safety" },
  { id: "aed", label: "AED / defibrillator", color: "#9f1239", shape: "circle", short: "A", category: "safety" },
  { id: "shutoff", label: "Shut-off / isolation", color: "#4c1d95", shape: "diamond", short: "S", category: "safety" },
  { id: "parking", label: "Parking", color: "#475569", shape: "square", short: "P", category: "logistics" },
  { id: "loading_bay", label: "Loading / delivery bay", color: "#7c3aed", shape: "square", short: "L", category: "logistics" },
  { id: "welfare", label: "Welfare / facilities", color: "#0369a1", shape: "circle", short: "W", category: "logistics" },
  { id: "crane_zone", label: "Crane / lifting zone", color: "#a16207", shape: "diamond", short: "C", category: "logistics" },
  { id: "pedestrian_route", label: "Pedestrian route", color: "#0d9488", shape: "circle", short: "Ped", category: "logistics" },
  { id: "vehicle_route", label: "Vehicle route", color: "#64748b", shape: "circle", short: "V", category: "logistics" },
  /** ATEX / DSEAR hazardous zone marker on the site plan (metadata on the object). */
  { id: "atex_zone", label: "ATEX / DSEAR zone", color: "#A32D2D", shape: "diamond", short: "AT", category: "hazard" },
  { id: "site_area", label: "Site area (polygon)", color: "#0C447C", shape: "square", short: "A", category: "area", isArea: true },
];

const TYPE_BY_ID = Object.fromEntries(PROJECT_DRAWING_OBJECT_TYPES.map((t) => [t.id, t]));

function normalizePercent(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

const GEO_FALLBACK = { lat: 51.505, lng: -0.09 };

function normalizeAtexMeta(meta) {
  if (!meta || typeof meta !== "object") return {};
  return {
    areaClassification: String(meta.areaClassification || "").slice(0, 32),
    atmosphereType: String(meta.atmosphereType || "").slice(0, 24),
    substance: String(meta.substance || "").slice(0, 160),
    temperatureClass: String(meta.temperatureClass || "").slice(0, 8),
    equipmentGroup: String(meta.equipmentGroup || "").slice(0, 16),
    permitRequired: Boolean(meta.permitRequired),
  };
}

function normalizeRing(row) {
  if (!Array.isArray(row.ring)) return [];
  const placement = row.placement === "map" ? "map" : "plan";
  return row.ring
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      if (placement === "map") {
        const lat = Number(p.geoLat ?? p.lat);
        const lng = Number(p.geoLng ?? p.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { geoLat: Math.max(-85, Math.min(85, lat)), geoLng: Math.max(-180, Math.min(180, lng)) };
      }
      return { x: normalizePercent(p.x), y: normalizePercent(p.y) };
    })
    .filter(Boolean)
    .slice(0, 120);
}

function normalizeObject(row) {
  if (!row || typeof row !== "object") return null;
  const type = TYPE_BY_ID[row.type] ? row.type : "zone";
  const placement = row.placement === "map" ? "map" : "plan";
  const geometry = row.geometry === "polygon" || TYPE_BY_ID[type]?.isArea ? "polygon" : "point";
  let geoLat = null;
  let geoLng = null;
  const ring = geometry === "polygon" ? normalizeRing(row) : [];
  if (placement === "map") {
    const gla = Number(row.geoLat);
    const gln = Number(row.geoLng);
    if (Number.isFinite(gla) && Number.isFinite(gln)) {
      geoLat = Math.max(-85, Math.min(85, gla));
      geoLng = Math.max(-180, Math.min(180, gln));
    } else if (ring.length >= 3) {
      let sLat = 0;
      let sLng = 0;
      ring.forEach((p) => {
        sLat += p.geoLat;
        sLng += p.geoLng;
      });
      geoLat = sLat / ring.length;
      geoLng = sLng / ring.length;
    } else {
      geoLat = GEO_FALLBACK.lat;
      geoLng = GEO_FALLBACK.lng;
    }
  }
  let x = normalizePercent(row.x);
  let y = normalizePercent(row.y);
  if (geometry === "polygon" && ring.length >= 3 && placement !== "map") {
    let sx = 0;
    let sy = 0;
    ring.forEach((p) => {
      sx += p.x;
      sy += p.y;
    });
    x = normalizePercent(sx / ring.length, x);
    y = normalizePercent(sy / ring.length, y);
  }
  const meta =
    type === "atex_zone"
      ? normalizeAtexMeta(row.meta)
      : geometry === "polygon"
        ? {
            areaKind: String(row.meta?.areaKind || "exclusion").slice(0, 24),
            notes: String(row.meta?.notes || "").slice(0, 200),
          }
        : {};
  return {
    id: String(row.id || `pdo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    projectId: String(row.projectId || ""),
    planId: String(row.planId || ""),
    type,
    label: String(row.label || "").slice(0, 120),
    x,
    y,
    placement,
    geometry,
    ring,
    geoLat,
    geoLng,
    meta,
    createdAt: String(row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

/** Map-placed objects use WGS84 in geoLat/geoLng; plan objects use x/y % on the image. */
export function isMapPlacement(row) {
  return Boolean(row && row.placement === "map");
}

export function listProjectDrawingObjects() {
  const rows = load(PROJECT_DRAWING_OBJECTS_KEY, []);
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeObject).filter(Boolean).slice(0, MAX_OBJECTS);
}

export function saveProjectDrawingObjects(rows) {
  const safeRows = Array.isArray(rows) ? rows.map(normalizeObject).filter(Boolean).slice(0, MAX_OBJECTS) : [];
  save(PROJECT_DRAWING_OBJECTS_KEY, safeRows);
}

export function objectsForProject(projectId, rows = listProjectDrawingObjects()) {
  return asStorageArray(rows).filter((row) => row.projectId === String(projectId || ""));
}

export function buildProjectDrawingObject(input = {}) {
  const now = new Date().toISOString();
  return normalizeObject({
    id: `pdo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId: input.projectId,
    planId: input.planId,
    type: input.type,
    label: input.label,
    x: input.x,
    y: input.y,
    placement: input.placement,
    geometry: input.geometry,
    ring: input.ring,
    geoLat: input.geoLat,
    geoLng: input.geoLng,
    meta: input.meta,
    createdAt: now,
    updatedAt: now,
  });
}

export function drawingObjectLabel(row) {
  if (!row) return "";
  const typeLabel = TYPE_BY_ID[row.type]?.label || "Point";
  const base = String(row.label || "").trim();
  const ac = row.type === "atex_zone" && row.meta?.areaClassification ? ` [${row.meta.areaClassification}]` : "";
  if (base) return `${base} (${typeLabel})${ac}`;
  return `${typeLabel}${ac}`;
}

export function drawingObjectTypeMeta(type) {
  return TYPE_BY_ID[type] || TYPE_BY_ID.zone;
}

export function drawingObjectCategories() {
  const order = ["general", "safety", "logistics", "hazard", "area"];
  const labels = {
    general: "General",
    safety: "Safety & emergency",
    logistics: "Parking & logistics",
    hazard: "Hazardous areas",
    area: "Drawn areas",
  };
  return order.map((id) => ({ id, label: labels[id] || id }));
}
