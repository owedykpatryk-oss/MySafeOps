/**
 * Animated SVG health ring for register / More section pulse.
 */
import { useEffect, useRef, useState } from "react";

export default function RegisterHealthRing({ score = 0, color = "#0d9488", size = 56, label = "Health" }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (safe / 100) * circ;
  const prevScore = useRef(safe);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevScore.current !== safe && safe > prevScore.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 850);
      prevScore.current = safe;
      return () => window.clearTimeout(t);
    }
    prevScore.current = safe;
    return undefined;
  }, [safe]);

  return (
    <div
      className={`app-register-ring${pulse ? " app-register-ring--pulse" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="app-register-ring__svg">
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cx})`}
          className="app-register-ring__progress"
        />
      </svg>
      <div className="app-register-ring__center">
        <span className="app-register-ring__score" style={{ color }}>
          {safe}%
        </span>
        <span className="app-register-ring__label">{label}</span>
      </div>
    </div>
  );
}
