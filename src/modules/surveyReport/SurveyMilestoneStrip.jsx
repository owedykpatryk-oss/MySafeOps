import { memo, useMemo } from "react";
import { getSurveyMilestones, surveyMilestoneProgress } from "./surveyMilestones";

function SurveyMilestoneStrip({ report, onGoToTab }) {
  const milestones = useMemo(() => getSurveyMilestones(report), [report]);
  const progress = useMemo(() => surveyMilestoneProgress(milestones), [milestones]);

  return (
    <div className="app-survey-milestones" role="list" aria-label={`Survey progress ${progress.done} of ${progress.total} milestones`}>
      <div className="app-survey-milestones__track" aria-hidden>
        <div className="app-survey-milestones__track-fill" style={{ width: `${progress.pct}%` }} />
      </div>
      <div className="app-survey-milestones__items">
        {milestones.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="listitem"
            className={`app-survey-milestone${m.done ? " app-survey-milestone--done" : ""}`}
            style={{ "--ms-i": i }}
            onClick={() => onGoToTab?.(m.tab)}
            title={m.detail ? `${m.label} (${m.detail})` : m.label}
          >
            <span className="app-survey-milestone__dot" aria-hidden>
              {m.done ? "✓" : i + 1}
            </span>
            <span className="app-survey-milestone__label">{m.label}</span>
            {m.detail && !m.done ? <span className="app-survey-milestone__detail">{m.detail}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(SurveyMilestoneStrip);
