/** Mini 7-day activity sparkline for More module tiles — tap bars for day counts. */
import { useState } from "react";

function formatDayLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function ModuleTileSparkline({ sparkline, tone = "active" }) {
  const [activeIdx, setActiveIdx] = useState(null);
  if (!sparkline?.buckets?.length) return null;
  const { buckets, max, bucketDates } = sparkline;
  const w = 4;
  const gap = 2;
  const height = 12;
  const fill =
    tone === "attention" ? "#f59e0b" : tone === "empty" ? "#cbd5e1" : "#0d9488";

  const activeLabel =
    activeIdx != null
      ? `${formatDayLabel(bucketDates?.[activeIdx])}: ${buckets[activeIdx]} record${buckets[activeIdx] === 1 ? "" : "s"}`
      : null;

  return (
    <span className="app-more-tile__spark-wrap">
      <svg
        className="app-more-tile__spark"
        viewBox={`0 0 ${buckets.length * (w + gap) - gap} ${height}`}
        width={buckets.length * (w + gap) - gap}
        height={height}
        role="img"
        aria-label={activeLabel || `Activity over last ${buckets.length} days`}
      >
        {buckets.map((v, i) => {
          const barH = Math.max(1.5, (v / max) * (height - 1));
          return (
            <rect
              key={i}
              x={i * (w + gap)}
              y={height - barH}
              width={w}
              height={barH}
              rx={1}
              fill={fill}
              opacity={activeIdx === i ? 1 : v === 0 ? 0.35 : 0.55 + (v / max) * 0.45}
              className="app-more-tile__spark-bar"
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              onFocus={() => setActiveIdx(i)}
              onBlur={() => setActiveIdx(null)}
              tabIndex={0}
            />
          );
        })}
      </svg>
      {activeLabel ? <span className="app-more-tile__spark-tip">{activeLabel}</span> : null}
    </span>
  );
}
