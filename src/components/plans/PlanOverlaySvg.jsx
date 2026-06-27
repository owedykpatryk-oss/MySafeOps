/** Shared SVG overlay for escape routes, zones and emergency assets on plan images. */

function routePolylinePoints(route) {
  if (Array.isArray(route.points) && route.points.length >= 2) {
    return route.points.map((p) => `${p.x},${p.y}`).join(" ");
  }
  return null;
}

const ZONE_FILL = {
  exclusion: "rgba(220,38,38,0.22)",
  hazard: "rgba(234,88,12,0.22)",
  work: "rgba(14,116,144,0.18)",
  muster: "rgba(22,101,52,0.2)",
};

export default function PlanOverlaySvg({ plan, interactive = false, draftRoutePoints = [], draftZone = null }) {
  const pointerEvents = interactive ? "auto" : "none";
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, pointerEvents }}
      aria-hidden={!interactive}
    >
      {(plan.zoneBlocks || []).map((z) => (
        <g key={z.id}>
          <rect
            x={z.x}
            y={z.y}
            width={z.w}
            height={z.h}
            fill={ZONE_FILL[z.kind] || ZONE_FILL.exclusion}
            stroke="#b91c1c"
            strokeWidth="0.35"
            rx="0.4"
          />
          {z.label ? (
            <text x={z.x + 0.8} y={z.y + 2.2} fontSize="2.2" fill="#7f1d1d" style={{ pointerEvents: "none" }}>
              {z.label.slice(0, 40)}
            </text>
          ) : null}
        </g>
      ))}
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
        />
      ) : null}
      {(plan.escapeRoutes || []).map((r) => {
        const poly = routePolylinePoints(r);
        if (poly) {
          return (
            <g key={r.id}>
              <polyline points={poly} fill="none" stroke="#0C447C" strokeWidth="0.9" strokeDasharray="1.5 1.2" />
              {r.points?.length ? (
                <circle cx={r.points[r.points.length - 1].x} cy={r.points[r.points.length - 1].y} r="1.2" fill="#0C447C" />
              ) : null}
            </g>
          );
        }
        return (
          <g key={r.id}>
            <line x1={r.startX} y1={r.startY} x2={r.endX} y2={r.endY} stroke="#0C447C" strokeWidth="0.9" strokeDasharray="1.5 1.2" />
            <circle cx={r.endX} cy={r.endY} r="1.2" fill="#0C447C" />
          </g>
        );
      })}
      {draftRoutePoints.length >= 1 ? (
        <polyline
          points={draftRoutePoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#0284c7"
          strokeWidth="0.7"
          strokeDasharray="1 1"
        />
      ) : null}
      {draftRoutePoints.map((p, i) => (
        <circle key={`dr-${i}`} cx={p.x} cy={p.y} r="0.9" fill="#0284c7" />
      ))}
    </svg>
  );
}

export function EmergencyAssetMarkers({ plan }) {
  return (plan.emergencyAssets || []).map((a) => (
    <div
      key={a.id}
      title={`${a.kind}${a.label ? ` · ${a.label}` : ""}`}
      className="plan-markup-asset"
      style={{
        left: `${a.x}%`,
        top: `${a.y}%`,
      }}
    />
  ));
}
