import { memo, useMemo, useState } from "react";
import { buildSurveyBlockers } from "./surveyReportBlockers";
import { SURVEY_AUTOFIX_ACTIONS, suggestSurveyAutofixes } from "./surveyAutofix";

function SurveyBlockersPanel({ report, context, onGoToTab, onAutofix }) {
  const [open, setOpen] = useState(true);
  const { blockers, score } = useMemo(() => buildSurveyBlockers(report, context), [report, context]);
  const autofixIds = useMemo(() => suggestSurveyAutofixes(report), [report]);
  const autofixActions = useMemo(
    () => SURVEY_AUTOFIX_ACTIONS.filter((a) => autofixIds.includes(a.id)),
    [autofixIds]
  );
  const critical = blockers.filter((b) => b.severity === "block");
  const warnings = blockers.filter((b) => b.severity === "warn");
  const hints = blockers.filter((b) => b.severity === "info");

  if (report?.status === "final" && blockers.length === 0) {
    return (
      <div className="app-survey-blockers app-survey-blockers--ok" role="status">
        <strong>Final issue</strong> — all checks passed ({score}% quality score).
      </div>
    );
  }

  if (blockers.length === 0 && autofixActions.length === 0) {
    return (
      <div className="app-survey-blockers app-survey-blockers--ok" role="status">
        <strong>Looking good</strong> — {score}% complete. Review print preview before marking final.
      </div>
    );
  }

  return (
    <section
      className={`app-survey-blockers${critical.length ? " app-survey-blockers--critical" : warnings.length ? " app-survey-blockers--warn" : ""}`}
      aria-label="Survey quality blockers"
    >
      <button type="button" className="app-survey-blockers__toggle" onClick={() => setOpen((v) => !v)}>
        <span>
          {critical.length ? "Cannot finalise yet" : "Complete before issue"} — {blockers.length} item
          {blockers.length === 1 ? "" : "s"} · {score}%
        </span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="app-survey-blockers__body">
          {[...critical, ...warnings, ...hints].map((b) => (
            <div key={b.id} className={`app-survey-blockers__row app-survey-blockers__row--${b.severity}`}>
              <span>{b.label}</span>
              {onGoToTab && b.tab ? (
                <button type="button" className="app-survey-blockers__fix" onClick={() => onGoToTab(b.tab)}>
                  Fix →
                </button>
              ) : null}
            </div>
          ))}
          {autofixActions.length > 0 && onAutofix ? (
            <div className="app-survey-blockers__quick">
              <span className="app-survey-blockers__quick-label">Quick fixes</span>
              <div className="app-survey-blockers__quick-row">
                {autofixActions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="app-survey-blockers__quick-btn"
                    onClick={() => {
                      onAutofix(a.id);
                      if (a.tab && onGoToTab) onGoToTab(a.tab);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="app-survey-blockers__collapsed">Panel collapsed — expand to see blockers and quick fixes.</p>
      )}
    </section>
  );
}

export default memo(SurveyBlockersPanel);
