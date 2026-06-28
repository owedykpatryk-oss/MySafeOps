/**
 * Rasterise a site plan image + markup overlay to a JPEG data URL (browser only).
 */
import { planDisplaySrc } from "../modules/permits/permitPlanOverlayRegistry";
import { assetKindMeta, zoneKindMeta, PLAN_ROUTE_STYLE } from "./planMarkupMeta";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load plan image"));
    img.src = src;
  });
}

function routePoints(route) {
  if (Array.isArray(route.points) && route.points.length >= 2) return route.points;
  if (route.startX != null && route.endX != null) {
    return [
      { x: route.startX, y: route.startY },
      { x: route.endX, y: route.endY },
    ];
  }
  return [];
}

function drawOverlay(ctx, plan, w, h) {
  const x = (pct) => (pct / 100) * w;
  const y = (pct) => (pct / 100) * h;

  (plan.zoneBlocks || []).forEach((z) => {
    const meta = zoneKindMeta(z.kind);
    ctx.fillStyle = meta.fill;
    ctx.strokeStyle = meta.stroke;
    ctx.lineWidth = Math.max(1, w * 0.004);
    const rx = x(z.x);
    const ry = y(z.y);
    const rw = x(z.w);
    const rh = y(z.h);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    if (z.label) {
      ctx.fillStyle = meta.stroke;
      ctx.font = `${Math.max(10, w * 0.018)}px sans-serif`;
      ctx.fillText(String(z.label).slice(0, 36), rx + 4, ry + Math.max(14, h * 0.022));
    }
  });

  (plan.escapeRoutes || []).forEach((r) => {
    const pts = routePoints(r);
    if (pts.length < 2) return;
    ctx.strokeStyle = PLAN_ROUTE_STYLE.stroke;
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.setLineDash([w * 0.012, w * 0.01]);
    ctx.beginPath();
    ctx.moveTo(x(pts[0].x), y(pts[0].y));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(x(pts[i].x), y(pts[i].y));
    ctx.stroke();
    ctx.setLineDash([]);
    const end = pts[pts.length - 1];
    ctx.fillStyle = PLAN_ROUTE_STYLE.stroke;
    ctx.beginPath();
    ctx.arc(x(end.x), y(end.y), Math.max(3, w * 0.008), 0, Math.PI * 2);
    ctx.fill();
    if (r.label) {
      const mid = pts[Math.floor(pts.length / 2)];
      ctx.fillStyle = PLAN_ROUTE_STYLE.stroke;
      ctx.font = `600 ${Math.max(9, w * 0.016)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(r.label).slice(0, 24), x(mid.x), y(mid.y) - 6);
      ctx.textAlign = "left";
    }
  });

  (plan.emergencyAssets || []).forEach((a) => {
    const meta = assetKindMeta(a.kind);
    const cx = x(a.x);
    const cy = y(a.y);
    const r = Math.max(6, w * 0.014);
    ctx.fillStyle = meta.bg;
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = meta.color;
    ctx.font = `700 ${Math.max(8, r * 0.9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.short || "•", cx, cy);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    if (a.label) {
      ctx.font = `${Math.max(8, w * 0.014)}px sans-serif`;
      ctx.fillStyle = "#0f172a";
      ctx.fillText(String(a.label).slice(0, 28), cx + r + 3, cy + 3);
    }
  });
}

/** @returns {Promise<string>} JPEG data URL */
export async function renderPlanSnapshotDataUrl(plan, { maxWidth = 720, quality = 0.82 } = {}) {
  if (typeof document === "undefined") throw new Error("Plan snapshot requires a browser environment.");
  const src = planDisplaySrc(plan);
  if (!src) throw new Error("Plan has no raster image for snapshot.");

  const img = await loadImage(src);
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.drawImage(img, 0, 0, w, h);
  drawOverlay(ctx, plan, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

/** Capture up to N plan snapshots for PDF appendix. */
export async function capturePlanSnapshots(plans, { maxPlans = 2 } = {}) {
  const out = [];
  for (const plan of (plans || []).slice(0, maxPlans)) {
    try {
      const dataUrl = await renderPlanSnapshotDataUrl(plan);
      out.push({
        planId: plan.id,
        name: plan.name || "Site plan",
        dataUrl,
        capturedAt: new Date().toISOString(),
      });
    } catch {
      /* skip plans without raster or load errors */
    }
  }
  return out;
}
