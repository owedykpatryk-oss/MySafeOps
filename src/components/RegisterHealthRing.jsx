/**
 * Animated SVG health ring for register / More section pulse.
 */
export default function RegisterHealthRing({ score = 0, color = "#0d9488", size = 56, label = "Health" }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (safe / 100) * circ;

  return (
    <div className="app-register-ring" style={{ width: size, height: size }} aria-hidden>
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
