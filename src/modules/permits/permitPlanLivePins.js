import { derivePermitStatus } from "./permitRules";

/**
 * Resolve a permit's position on a site plan via linked drawing object.
 * @returns {{ planId: string, x: number, y: number, objectId: string, label: string } | null}
 */
export function resolvePermitPlanPin(permit, drawingObjects = []) {
  const objectId = String(permit?.locationObjectId || "").trim();
  if (!objectId) return null;
  const obj = drawingObjects.find((row) => row.id === objectId);
  if (!obj || obj.placement !== "plan") return null;
  const planId = String(obj.planId || "").trim();
  if (!planId) return null;
  return {
    planId,
    x: Number(obj.x) || 50,
    y: Number(obj.y) || 50,
    objectId: obj.id,
    label: String(obj.label || "").trim(),
  };
}

/**
 * Permits with plan pins for a given uploaded plan.
 */
export function permitsForPlan(
  permits = [],
  planId,
  drawingObjects = [],
  now = new Date(),
  { includeStatuses } = {}
) {
  const pid = String(planId || "").trim();
  if (!pid) return [];
  const statuses =
    includeStatuses || ["active", "pending_review", "approved", "expired", "suspended"];
  return permits
    .map((permit) => {
      const pin = resolvePermitPlanPin(permit, drawingObjects);
      if (!pin || pin.planId !== pid) return null;
      const status = derivePermitStatus(permit, now);
      if (!statuses.includes(status)) return null;
      return { permit, pin, status };
    })
    .filter(Boolean);
}

/**
 * SIMOPS conflict pairs where both permits are pinned on the same plan.
 */
export function simopsPairsForPlan(placements = [], simopsMap) {
  const pairs = [];
  const seen = new Set();
  const byId = new Map(placements.map((row) => [row.permit.id, row]));

  placements.forEach(({ permit }) => {
    const conflicts = simopsMap?.get(permit.id) || [];
    conflicts.forEach((other) => {
      const key = [permit.id, other.id].sort().join(":");
      if (seen.has(key)) return;
      const a = byId.get(permit.id);
      const b = byId.get(other.id);
      if (!a || !b) return;
      seen.add(key);
      pairs.push({ a, b });
    });
  });
  return pairs;
}
