import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

const PROJECT_DRAWING_OBJECTS_KEY = "project_drawing_objects_v1";
const MAX_OBJECTS = 1500;

export const PROJECT_DRAWING_OBJECT_TYPES = [
  { id: "zone", label: "Zone", color: "#0C447C", shape: "circle" },
  { id: "excavation", label: "Excavation", color: "#7C2D12", shape: "diamond" },
  { id: "fire_exit", label: "Fire exit", color: "#166534", shape: "square" },
  { id: "master_point", label: "Master point", color: "#7E22CE", shape: "star" },
];

const TYPE_BY_ID = Object.fromEntries(PROJECT_DRAWING_OBJECT_TYPES.map((t) => [t.id, t]));

function normalizePercent(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

const GEO_FALLBACK = { lat: 51.505, lng: -0.09 };

function normalizeObject(row) {
  if (!row || typeof row !== "object") return null;
  const type = TYPE_BY_ID[row.type] ? row.type : "zone";
  const placement = row.placement === "map" ? "map" : "plan";
  let geoLat = null;
  let geoLng = null;
  if (placement === "map") {
    const gla = Number(row.geoLat);
    const gln = Number(row.geoLng);
    if (Number.isFinite(gla) && Number.isFinite(gln)) {
      geoLat = Math.max(-85, Math.min(85, gla));
      geoLng = Math.max(-180, Math.min(180, gln));
    } else {
      geoLat = GEO_FALLBACK.lat;
      geoLng = GEO_FALLBACK.lng;
    }
  }
  return {
    id: String(row.id || `pdo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    projectId: String(row.projectId || ""),
    planId: String(row.planId || ""),
    type,
    label: String(row.label || "").slice(0, 120),
    x: normalizePercent(row.x),
    y: normalizePercent(row.y),
    placement,
    geoLat,
    geoLng,
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
  return (rows || []).filter((row) => row.projectId === String(projectId || ""));
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
    geoLat: input.geoLat,
    geoLng: input.geoLng,
    createdAt: now,
    updatedAt: now,
  });
}

export function drawingObjectLabel(row) {
  if (!row) return "";
  const typeLabel = TYPE_BY_ID[row.type]?.label || "Point";
  const base = String(row.label || "").trim();
  return base ? `${base} (${typeLabel})` : typeLabel;
}

export function drawingObjectTypeMeta(type) {
  return TYPE_BY_ID[type] || TYPE_BY_ID.zone;
}
