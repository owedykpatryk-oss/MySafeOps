import { memo, useMemo } from "react";
import { SURVEY_SIMPLE_STEPS, simpleStepForTab } from "./surveySimpleEditorNav";
import { surveyTabIsComplete } from "./surveyReportListUtils";

function SurveySimpleStepNav({ tab, report, onTabChange }) {
  const activeStep = simpleStepForTab(tab).id;

  const stepProgress = useMemo(() => {
    const out = {};
    SURVEY_SIMPLE_STEPS.forEach((step) => {
      const tabs = step.tabs || [];
      const done = tabs.filter((t) => surveyTabIsComplete(report, t)).length;
      out[step.id] = { done, total: tabs.length, complete: done === tabs.length && tabs.length > 0 };
    });
    return out;
  }, [report]);

  return (
    <div className="app-survey-editor-nav app-survey-editor-nav--simple">
      <div className="app-survey-editor-nav__groups" role="tablist" aria-label="Survey steps">
        {SURVEY_SIMPLE_STEPS.map((step) => {
          const prog = stepProgress[step.id] || { done: 0, total: 1, complete: false };
          const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={activeStep === step.id}
              className={`app-survey-editor-nav__group${activeStep === step.id ? " app-survey-editor-nav__group--active" : ""}${prog.complete ? " app-survey-editor-nav__group--done" : ""}`}
              onClick={() => onTabChange(step.tabs[0])}
            >
              <span className="app-survey-editor-nav__group-top">
                <span className="app-survey-editor-nav__group-label">
                  {prog.complete ? <span className="app-survey-editor-nav__check" aria-hidden>✓</span> : null}
                  {step.label}
                </span>
                <span
                  className={`app-survey-editor-nav__group-badge${prog.complete ? " app-survey-editor-nav__group-badge--done" : ""}`}
                >
                  {prog.done}/{prog.total}
                </span>
              </span>
              <span className="app-survey-editor-nav__group-hint">{step.hint}</span>
              <span className="app-survey-editor-nav__group-meter" aria-hidden>
                <span className="app-survey-editor-nav__group-meter-fill" style={{ width: `${pct}%` }} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(SurveySimpleStepNav);
