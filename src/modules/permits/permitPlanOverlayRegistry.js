import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

const PLANS_KEY = "project_plan_overlays_v1";

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

export function buildPlanOverlayRecord({ projectId, name, mimeType, dataUrl, uploadedBy }) {
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId: String(projectId || ""),
    name: String(name || "Plan").slice(0, 120),
    mimeType: String(mimeType || "application/octet-stream"),
    dataUrl: String(dataUrl || ""),
    uploadedBy: String(uploadedBy || "unknown"),
    createdAt: new Date().toISOString(),
    revision: 1,
    status: "current",
    escapeRoutes: [],
    emergencyAssets: [],
  };
}

export function addPlanEmergencyAsset(plan, { kind = "muster", x = 50, y = 50, label = "" }) {
  const next = {
    id: `ea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind: String(kind || "asset").slice(0, 40),
    x: Math.max(0, Math.min(100, Number(x) || 0)),
    y: Math.max(0, Math.min(100, Number(y) || 0)),
    label: String(label || "").slice(0, 120),
    at: new Date().toISOString(),
  };
  return {
    ...plan,
    emergencyAssets: [...(plan.emergencyAssets || []), next].slice(0, 200),
  };
}

export function addPlanEscapeRoute(plan, { startX = 20, startY = 80, endX = 80, endY = 20, label = "" }) {
  const next = {
    id: `er_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    startX: Math.max(0, Math.min(100, Number(startX) || 0)),
    startY: Math.max(0, Math.min(100, Number(startY) || 0)),
    endX: Math.max(0, Math.min(100, Number(endX) || 0)),
    endY: Math.max(0, Math.min(100, Number(endY) || 0)),
    label: String(label || "").slice(0, 120),
    at: new Date().toISOString(),
  };
  return {
    ...plan,
    escapeRoutes: [...(plan.escapeRoutes || []), next].slice(0, 120),
  };
}

