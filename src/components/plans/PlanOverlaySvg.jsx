/** Shared SVG overlay for escape routes, zones and emergency assets on plan images. */

import { PLAN_ROUTE_STYLE, zoneKindMeta } from "../../utils/planMarkupMeta";

function routePolylinePoints(route) {
  if (Array.isArray(route.points) && route.points.length >= 2) {
    return route.points.map((p) => `${p.x},${p.y}`).join(" ");
  }
  return null;
}

function routeMidLabel(route) {
  const pts = route.points;
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const mid = pts[Math.floor(pts.length / 2)];
  return { x: mid.x, y: mid.y, text: route.label };
}

export default function PlanOverlaySvg({
  plan,
  interactive = false,
  draftRoutePoints = [],
  draftZone = null,
  selected = null,
  onItemPointerDown,
}) {
  const isSelected = (type, id) => selected?.type === type && selected?.id === id;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="plan-overlay-svg"
      style={{ position: "absolute", inset: 0, pointerEvents: interactive ? "auto" : "none" }}
      aria-hidden={!interactive}
    >
      {(plan.zoneBlocks || []).map((z) => {
        const meta = zoneKindMeta(z.kind);
        const active = isSelected("zone", z.id);
        return (
          <g key={z.id} data-plan-item="zone" data-id={z.id}>
            <rect
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              fill={meta.fill}
              stroke={active ? "#0f172a" : meta.stroke}
              strokeWidth={active ? "0.55" : "0.35"}
              rx="0.4"
              style={{ cursor: interactive ? "move" : undefined }}
              onPointerDown={interactive ? (e) => onItemPointerDown?.(e, "zone", z.id) : undefined}
            />
            {z.label ? (
              <text
                x={z.x + 0.8}
                y={z.y + 2.2}
                fontSize="2"
                fill={meta.stroke}
                style={{ pointerEvents: "none" }}
              >
                {z.label.slice(0, 36)}
              </text>
            ) : null}
            {active && interactive ? (
              <rect
                x={z.x + z.w - 2.2}
                y={z.y + z.h - 2.2}
                width="2"
                height="2"
                fill="#0f172a"
                data-handle="resize"
                style={{ cursor: "nwse-resize" }}
                onPointerDown={(e) => onItemPointerDown?.(e, "zone-resize", z.id)}
              />
            ) : null}
          </g>
        );
      })}
      {draftZone ? (
        <rect
          x={draftZone.x}
          y={draftZone.y}
          width={draftZone.w}
          height={draftZone.h}
          fill="rgba(220,38,38,0.12)"
          stroke="#dc2626"
          strokeWidth="0.4"
          strokeDasharray="1 0.8"
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {(plan.escapeRoutes || []).map((r) => {
        const poly = routePolylinePoints(r);
        const active = isSelected("route", r.id);
        const label = routeMidLabel(r);
        if (poly) {
          return (
            <g key={r.id} data-plan-item="route" data-id={r.id}>
              <polyline
                points={poly}
                fill="none"
                stroke={active ? "#0f172a" : PLAN_ROUTE_STYLE.stroke}
                strokeWidth={active ? "1.1" : "0.9"}
                strokeDasharray={PLAN_ROUTE_STYLE.dash}
                style={{ pointerEvents: interactive ? "stroke" : "none", cursor: interactive ? "pointer" : undefined }}
                onPointerDown={interactive ? (e) => onItemPointerDown?.(e, "route", r.id) : undefined}
              />
              {(r.points || []).map((p, idx) =>
                active && interactive ? (
                  <circle
                    key={`${r.id}-pt-${idx}`}
                    cx={p.x}
                    cy={p.y}
                    r="1.4"
                    fill="#fff"
                    stroke="#0C447C"
                    strokeWidth="0.45"
                    data-point-index={idx}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => onItemPointerDown?.(e, "route-point", r.id, idx)}
                  />
                ) : null
              )}
              {label?.text ? (
                <text x={label.x} y={label.y - 1.2} fontSize="1.8" fill="#0C447C" textAnchor="middle" style={{ pointerEvents: "none" }}>
                  {String(label.text).slice(0, 24)}
                </text>
              ) : null}
              {r.points?.length ? (
                <circle
                  cx={r.points[r.points.length - 1].x}
                  cy={r.points[r.points.length - 1].y}
                  r="1.2"
                  fill={PLAN_ROUTE_STYLE.stroke}
                  style={{ pointerEvents: "none" }}
                />
              ) : null}
            </g>
          );
        }
        return (
          <g key={r.id}>
            <line
              x1={r.startX}
              y1={r.startY}
              x2={r.endX}
              y2={r.endY}
              stroke={PLAN_ROUTE_STYLE.stroke}
              strokeWidth="0.9"
              strokeDasharray={PLAN_ROUTE_STYLE.dash}
            />
            <circle cx={r.endX} cy={r.endY} r="1.2" fill={PLAN_ROUTE_STYLE.stroke} />
          </g>
        );
      })}
      {draftRoutePoints.length >= 1 ? (
        <polyline
          points={draftRoutePoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={PLAN_ROUTE_STYLE.draftStroke}
          strokeWidth="0.7"
          strokeDasharray="1 1"
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {draftRoutePoints.map((p, i) => (
        <circle key={`dr-${i}`} cx={p.x} cy={p.y} r="0.9" fill={PLAN_ROUTE_STYLE.draftStroke} style={{ pointerEvents: "none" }} />
      ))}
    </svg>
  );
}

export function EmergencyAssetMarkers({ plan, interactive = false, selected = null, onAssetPointerDown }) {
  return (plan.emergencyAssets || []).map((a) => {
    const active = selected?.type === "asset" && selected?.id === a.id;
    return (
      <div
        key={a.id}
        title={`${a.kind}${a.label ? ` · ${a.label}` : ""}`}
        className={`plan-markup-asset plan-markup-asset--${a.kind}${active ? " plan-markup-asset--active" : ""}`}
        data-kind={a.kind}
        style={{
          left: `${a.x}%`,
          top: `${a.y}%`,
          cursor: interactive ? "grab" : undefined,
        }}
        onPointerDown={interactive ? (e) => onAssetPointerDown?.(e, a.id) : undefined}
      >
        <span className="plan-markup-asset__dot" aria-hidden />
        {a.label ? <span className="plan-markup-asset__label">{a.label.slice(0, 28)}</span> : null}
      </div>
    );
  });
}
