import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

const PLANS_KEY = "project_plan_overlays_v1";

export const PLAN_UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf,.kml,.kmz";
export const PLAN_UPLOAD_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
export const PLAN_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export function clampPercent(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

export function listProjectPlans() {
  const rows = load(PLANS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function saveProjectPlans(rows) {
  save(PLANS_KEY, Array.isArray(rows) ? rows : []);
}

export function plansForProject(projectId, rows = listProjectPlans()) {
  return (rows || []).filter((p) => p?.projectId === projectId);
}

export function updateProjectPlan(rows, planId, updater) {
  return (rows || []).map((p) => (p.id === planId ? updater(p) : p));
}

export function planDisplaySrc(plan) {
  if (!plan) return "";
  if (plan.rasterDataUrl) return plan.rasterDataUrl;
  const mime = String(plan.mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "";
  return plan.dataUrl || "";
}

export function planIsMarkable(plan) {
  return Boolean(planDisplaySrc(plan));
}

export function buildPlanOverlayRecord({ projectId, name, mimeType, dataUrl, uploadedBy, rasterDataUrl = "" }) {
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId: String(projectId || ""),
    name: String(name || "Plan").slice(0, 120),
    mimeType: String(mimeType || "application/octet-stream"),
    dataUrl: String(dataUrl || ""),
    rasterDataUrl: String(rasterDataUrl || ""),
    uploadedBy: String(uploadedBy || "unknown"),
    createdAt: new Date().toISOString(),
    revision: 1,
    status: "current",
    escapeRoutes: [],
    emergencyAssets: [],
    zoneBlocks: [],
  };
}

export function readPlanUploadFile(file) {
  return new Promise((resolve, reject) => {
    const normalizedType = String(file?.type || "").toLowerCase();
    if (!PLAN_UPLOAD_MIME.has(normalizedType)) {
      reject(new Error("Only PNG, JPG, WEBP or PDF plans are supported."));
      return;
    }
    if (Number(file?.size || 0) > PLAN_UPLOAD_MAX_BYTES) {
      reject(new Error("Plan file is too large. Use files up to 8 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl: String(reader.result || ""),
      });
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function addPlanEmergencyAsset(plan, { kind = "muster", x = 50, y = 50, label = "" }) {
  const next = {
    id: `ea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind: String(kind || "asset").slice(0, 40),
    x: clampPercent(x),
    y: clampPercent(y),
    label: String(label || "").slice(0, 120),
    at: new Date().toISOString(),
  };
  return {
    ...plan,
    emergencyAssets: [...(plan.emergencyAssets || []), next].slice(0, 200),
  };
}

export function addPlanEscapeRoute(plan, { startX = 20, startY = 80, endX = 80, endY = 20, label = "", points = null }) {
  const next = {
    id: `er_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    startX: clampPercent(startX),
    startY: clampPercent(startY),
    endX: clampPercent(endX),
    endY: clampPercent(endY),
    label: String(label || "").slice(0, 120),
    at: new Date().toISOString(),
  };
  if (Array.isArray(points) && points.length >= 2) {
    next.points = points.map((p) => ({ x: clampPercent(p.x), y: clampPercent(p.y) }));
    next.startX = next.points[0].x;
    next.startY = next.points[0].y;
    const last = next.points[next.points.length - 1];
    next.endX = last.x;
    next.endY = last.y;
  }
  return {
    ...plan,
    escapeRoutes: [...(plan.escapeRoutes || []), next].slice(0, 120),
  };
}

export function addPlanZoneBlock(plan, { x = 10, y = 10, w = 20, h = 20, label = "", kind = "exclusion" }) {
  const next = {
    id: `zb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x: clampPercent(x),
    y: clampPercent(y),
    w: Math.max(1, Math.min(100, Number(w) || 1)),
    h: Math.max(1, Math.min(100, Number(h) || 1)),
    label: String(label || "").slice(0, 120),
    kind: String(kind || "exclusion").slice(0, 40),
    at: new Date().toISOString(),
  };
  return {
    ...plan,
    zoneBlocks: [...(plan.zoneBlocks || []), next].slice(0, 120),
  };
}

export function removePlanItem(plan, collectionKey, itemId) {
  const list = plan[collectionKey];
  if (!Array.isArray(list)) return plan;
  return { ...plan, [collectionKey]: list.filter((x) => x.id !== itemId) };
}
