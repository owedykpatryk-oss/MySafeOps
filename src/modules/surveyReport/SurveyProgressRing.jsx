import { useEffect, useState } from "react";

function scoreTone(pct) {
  if (pct >= 80) return { stroke: "#0d9488", glow: "rgba(13,148,136,0.35)" };
  if (pct >= 50) return { stroke: "#d97706", glow: "rgba(217,119,6,0.3)" };
  return { stroke: "#ea580c", glow: "rgba(234,88,12,0.3)" };
}

/** Animated SVG completion ring for survey editor and list rows. */
export default function SurveyProgressRing({
  value = 0,
  size = 72,
  stroke = 6,
  label,
  sublabel,
  className = "",
  animate = true,
}) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const [displayPct, setDisplayPct] = useState(animate ? 0 : pct);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPct / 100) * circumference;
  const tone = scoreTone(pct);
  const ready = pct >= 80;

  useEffect(() => {
    if (!animate) {
      setDisplayPct(pct);
      return undefined;
    }
    const start = performance.now();
    const from = displayPct;
    const delta = pct - from;
    if (Math.abs(delta) < 1) {
      setDisplayPct(pct);
      return undefined;
    }
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - t) ** 3;
      setDisplayPct(Math.round(from + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from prior display value
  }, [pct, animate]);

  return (
    <div
      className={`app-survey-progress-ring${ready ? " app-survey-progress-ring--ready" : ""}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, "--ring-glow": tone.glow }}
      aria-hidden={label == null && sublabel == null}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border-tertiary, #e5e7eb)"
          strokeWidth={stroke}
        />
        <circle
          className="app-survey-progress-ring__arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="app-survey-progress-ring__center">
        <span className="app-survey-progress-ring__value">{label ?? `${displayPct}%`}</span>
        {sublabel ? <span className="app-survey-progress-ring__sub">{sublabel}</span> : null}
      </div>
    </div>
  );
}
