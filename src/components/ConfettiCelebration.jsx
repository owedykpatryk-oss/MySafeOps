import { memo, useEffect } from "react";

const COLORS = ["#0d9488", "#14b8a6", "#2dd4bf", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];

/**
 * Lightweight confetti burst + banner for milestone moments across the app
 * (permit approved, RAMS issued, survey issued, etc). Auto-dismisses after
 * `durationMs` via `onDone` — pair with a boolean state flag.
 */
function ConfettiCelebration({ active, label = "Done", durationMs = 3200, onDone }) {
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(() => onDone?.(), durationMs);
    return () => window.clearTimeout(t);
  }, [active, durationMs, onDone]);

  if (!active) return null;

  return (
    <div className="app-celebrate" aria-hidden>
      <div className="app-celebrate__banner">{label}</div>
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="app-celebrate__piece"
          style={{
            "--i": i,
            "--rot": `${(i * 47) % 360}deg`,
            "--color": COLORS[i % COLORS.length],
            left: `${8 + ((i * 17) % 84)}%`,
          }}
        />
      ))}
    </div>
  );
}

export default memo(ConfettiCelebration);
