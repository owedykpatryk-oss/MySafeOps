import { memo, useEffect } from "react";

const COLORS = ["#0d9488", "#14b8a6", "#2dd4bf", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];

/** Lightweight confetti burst when a report is marked final. */
function SurveyIssueCelebration({ active, onDone }) {
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(() => onDone?.(), 3200);
    return () => window.clearTimeout(t);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div className="app-survey-celebrate" aria-hidden>
      <div className="app-survey-celebrate__banner">Report issued</div>
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="app-survey-celebrate__piece"
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

export default memo(SurveyIssueCelebration);
