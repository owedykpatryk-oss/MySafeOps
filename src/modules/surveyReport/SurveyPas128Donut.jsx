import { memo, useEffect, useMemo, useState } from "react";
import { pas128DonutSegments } from "./surveyPas128Visual";

function SurveyPas128Donut({ byQl, size = 88, stroke = 14, centerLabel, centerSub }) {
  const segments = useMemo(() => pas128DonutSegments(byQl), [byQl]);
  const total = useMemo(() => segments.reduce((n, s) => n + s.count, 0), [segments]);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, [segments]);

  if (!segments.length) return null;

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="app-survey-pas128-donut" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--color-border-tertiary, #e2e8f0)"
          strokeWidth={stroke}
        />
        {segments.map((seg, i) => {
          const dash = (seg.pct / 100) * circumference;
          const gap = circumference - dash;
          const rot = (seg.offset / 100) * 360 - 90;
          return (
            <circle
              key={seg.ql}
              className="app-survey-pas128-donut__seg"
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${animated ? dash : 0} ${gap}`}
              transform={`rotate(${rot} ${cx} ${cy})`}
              style={{ transition: `stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 0.08}s` }}
            />
          );
        })}
      </svg>
      <div className="app-survey-pas128-donut__center">
        <strong>{centerLabel ?? total}</strong>
        {centerSub ? <span>{centerSub}</span> : null}
      </div>
    </div>
  );
}

export default memo(SurveyPas128Donut);
