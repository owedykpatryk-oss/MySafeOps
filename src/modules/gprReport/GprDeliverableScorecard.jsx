import { memo, useMemo } from "react";
import { gprDeliverableProgress, gprSectionHealth } from "./gprReportPulse";

function Ring({ pct, tone, label }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const colour = tone === "ok" ? "#0d9488" : tone === "warn" ? "#d97706" : "#dc2626";

  return (
    <div className="app-gpr-scorecard-ring" title={`${label}: ${pct}%`}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
          className="app-gpr-scorecard-ring__arc"
        />
        <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">
          {pct}
        </text>
      </svg>
      <span className="app-gpr-scorecard-ring__label">{label}</span>
    </div>
  );
}

function GprDeliverableScorecard({ report }) {
  const del = useMemo(() => gprDeliverableProgress(report?.deliverables), [report?.deliverables]);
  const health = useMemo(() => gprSectionHealth(report), [report]);

  return (
    <div className="app-gpr-scorecard">
      <div className="app-gpr-scorecard__head">
        <strong>Deliverable pulse</strong>
        <span className="app-gpr-scorecard__badge">
          {del.done}/{del.total} outputs ticked
        </span>
      </div>
      <div className="app-gpr-scorecard__rings">
        {health.map((h) => (
          <Ring key={h.key} pct={h.pct} tone={h.tone} label={h.label} />
        ))}
      </div>
      <div className="app-gpr-scorecard__chips">
        {del.items.map((item) => (
          <span key={item.key} className={`app-gpr-scorecard__chip${item.done ? " app-gpr-scorecard__chip--done" : ""}`}>
            {item.done ? "✓" : "○"} {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(GprDeliverableScorecard);
