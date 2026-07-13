import { memo, useMemo } from "react";

const BAND_COLOUR = {
  excellent: "#0d9488",
  good: "#059669",
  fair: "#d97706",
  poor: "#ea580c",
  spent: "#dc2626",
};

function GprChainageChart({ segments = [] }) {
  const points = useMemo(() => {
    return segments
      .map((s, i) => {
        const start = Number(s.chainageStartM);
        const end = Number(s.chainageEndM);
        const depth = Number(s.thicknessOrDepthM);
        const mid = Number.isFinite(start) && Number.isFinite(end) ? (start + end) / 2 : i;
        return {
          id: s.id || i,
          x: mid,
          y: Number.isFinite(depth) ? depth : null,
          band: s.conditionBand,
          label: [s.lineRef, s.swathRef].filter(Boolean).join(" · ") || `Seg ${i + 1}`,
        };
      })
      .filter((p) => p.y != null);
  }, [segments]);

  if (points.length < 2) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys, 0.1);
  const pad = 24;
  const w = 480;
  const h = 140;
  const spanX = maxX - minX || 1;

  const coords = points.map((p) => ({
    ...p,
    sx: pad + ((p.x - minX) / spanX) * (w - pad * 2),
    sy: h - pad - (p.y / maxY) * (h - pad * 2),
  }));

  const pathD = coords.map((p, i) => `${i ? "L" : "M"}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");

  return (
    <div className="app-gpr-chainage-chart">
      <div className="app-gpr-chainage-chart__head">Chainage profile preview</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="app-gpr-chainage-chart__svg" role="img" aria-label="Chainage depth profile">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#cbd5e1" strokeWidth="1" />
        <text x={pad - 4} y={pad + 4} fontSize="9" fill="#64748b" textAnchor="end">
          {maxY.toFixed(1)} m
        </text>
        <text x={pad - 4} y={h - pad} fontSize="9" fill="#64748b" textAnchor="end">
          0
        </text>
        <path d={pathD} fill="none" stroke="#0c447c" strokeWidth="2" opacity="0.5" />
        {coords.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.sx}
              cy={p.sy}
              r="5"
              fill={BAND_COLOUR[p.band] || "#0c447c"}
              stroke="#fff"
              strokeWidth="1.5"
            />
            <title>{`${p.label}: ${p.y} m`}</title>
          </g>
        ))}
        <text x={w / 2} y={h - 6} fontSize="9" fill="#64748b" textAnchor="middle">
          Chainage (m)
        </text>
      </svg>
    </div>
  );
}

export default memo(GprChainageChart);
