/** Shared colours, labels and legend helpers for site plan markup. */

export const PLAN_ZONE_KINDS = [
  { id: "exclusion", label: "Exclusion / no-go", fill: "rgba(220,38,38,0.24)", stroke: "#b91c1c", swatch: "#dc2626" },
  { id: "hazard", label: "Hazard zone", fill: "rgba(234,88,12,0.24)", stroke: "#c2410c", swatch: "#ea580c" },
  { id: "access", label: "Access / egress", fill: "rgba(12,68,124,0.18)", stroke: "#0C447C", swatch: "#2563eb" },
  { id: "fire_lane", label: "Fire lane — keep clear", fill: "rgba(234,179,8,0.22)", stroke: "#a16207", swatch: "#ca8a04" },
  { id: "work", label: "Work area", fill: "rgba(14,116,144,0.18)", stroke: "#0e7490", swatch: "#0891b2" },
  { id: "muster", label: "Assembly / muster", fill: "rgba(22,101,52,0.22)", stroke: "#166534", swatch: "#16a34a" },
];

export const PLAN_ASSET_KINDS = [
  { id: "muster", label: "Muster point", short: "M", color: "#14532d", bg: "#dcfce7" },
  { id: "exit", label: "Emergency exit", short: "E", color: "#0C447C", bg: "#dbeafe" },
  { id: "extinguisher", label: "Fire extinguisher", short: "F", color: "#b91c1c", bg: "#fee2e2" },
  { id: "first_aid", label: "First aid", short: "+", color: "#7c2d12", bg: "#ffedd5" },
  { id: "shutoff", label: "Shut-off / isolation", short: "S", color: "#4c1d95", bg: "#ede9fe" },
  { id: "aed", label: "AED / defibrillator", short: "A", color: "#9f1239", bg: "#ffe4e6" },
];

export const PLAN_ROUTE_STYLE = {
  stroke: "#0C447C",
  draftStroke: "#0284c7",
  dash: "1.5 1.2",
  label: "Escape route",
};

const ZONE_BY_ID = Object.fromEntries(PLAN_ZONE_KINDS.map((z) => [z.id, z]));
const ASSET_BY_ID = Object.fromEntries(PLAN_ASSET_KINDS.map((a) => [a.id, a]));

export function zoneKindMeta(kind) {
  return ZONE_BY_ID[kind] || ZONE_BY_ID.exclusion;
}

export function assetKindMeta(kind) {
  return ASSET_BY_ID[kind] || { id: kind, label: kind, short: "?", color: "#14532d", bg: "#dcfce7" };
}

export function zoneKindLabel(kind) {
  return zoneKindMeta(kind).label;
}

export function assetKindLabel(kind) {
  return assetKindMeta(kind).label;
}

/** Auto legend from what is actually on the plan. */
export function buildPlanLegend(plan) {
  if (!plan) return { swatches: [], rows: [] };

  const swatchMap = new Map();
  const rows = [];

  (plan.escapeRoutes || []).forEach((r, i) => {
    rows.push({
      key: `route-${r.id}`,
      type: "route",
      label: r.label || `Escape route ${i + 1}`,
      detail: `${(r.points || []).length || 2} points`,
      swatch: { kind: "route", color: PLAN_ROUTE_STYLE.stroke },
    });
    swatchMap.set("route", { kind: "route", label: PLAN_ROUTE_STYLE.label, color: PLAN_ROUTE_STYLE.stroke, dash: true });
  });

  const zoneKindsUsed = [...new Set((plan.zoneBlocks || []).map((z) => z.kind))];
  zoneKindsUsed.forEach((kind) => {
    const meta = zoneKindMeta(kind);
    swatchMap.set(`zone-${kind}`, { kind: "zone", label: meta.label, color: meta.swatch, fill: meta.fill });
  });
  (plan.zoneBlocks || []).forEach((z, i) => {
    const meta = zoneKindMeta(z.kind);
    rows.push({
      key: `zone-${z.id}`,
      type: "zone",
      label: z.label || meta.label || `Zone ${i + 1}`,
      detail: meta.label,
      swatch: { kind: "zone", color: meta.swatch, fill: meta.fill },
    });
  });

  const assetKindsUsed = [...new Set((plan.emergencyAssets || []).map((a) => a.kind))];
  assetKindsUsed.forEach((kind) => {
    const meta = assetKindMeta(kind);
    swatchMap.set(`asset-${kind}`, { kind: "asset", label: meta.label, color: meta.color, short: meta.short });
  });
  (plan.emergencyAssets || []).forEach((a, i) => {
    const meta = assetKindMeta(a.kind);
    rows.push({
      key: `asset-${a.id}`,
      type: "asset",
      label: a.label || meta.label || `Asset ${i + 1}`,
      detail: meta.label,
      swatch: { kind: "asset", color: meta.color, short: meta.short },
    });
  });

  return {
    swatches: [...swatchMap.values()],
    rows,
    counts: {
      routes: (plan.escapeRoutes || []).length,
      zones: (plan.zoneBlocks || []).length,
      assets: (plan.emergencyAssets || []).length,
    },
  };
}

export const PLAN_MARKUP_PRESETS = [
  { id: "primary_route", label: "Primary escape route", tool: "escape_route", routeLabel: "Primary escape route" },
  { id: "secondary_route", label: "Secondary escape route", tool: "escape_route", routeLabel: "Secondary escape route" },
  { id: "exclusion", label: "No-go zone", tool: "zone", zoneKind: "exclusion", zoneLabel: "No access" },
  { id: "fire_lane", label: "Fire lane", tool: "zone", zoneKind: "fire_lane", zoneLabel: "Keep clear" },
  { id: "muster_zone", label: "Assembly area", tool: "zone", zoneKind: "muster", zoneLabel: "Muster / assembly" },
  { id: "muster_point", label: "Muster point", tool: "asset", assetKind: "muster", assetLabel: "Muster point" },
  { id: "emergency_exit", label: "Emergency exit", tool: "asset", assetKind: "exit", assetLabel: "Emergency exit" },
];
