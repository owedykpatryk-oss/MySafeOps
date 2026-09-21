import { memo, useMemo } from "react";
import { SURVEY_SIMPLE_STEPS, SURVEY_TAB_PLAIN_LABELS, simpleStepForTab } from "./surveySimpleEditorNav";
import { surveyTabIsComplete } from "./surveyReportListUtils";

function SurveySimpleStepNav({ tab, report, onTabChange }) {
  const activeStep = simpleStepForTab(tab);

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
              aria-selected={activeStep.id === step.id}
              className={`app-survey-editor-nav__group${activeStep.id === step.id ? " app-survey-editor-nav__group--active" : ""}${prog.complete ? " app-survey-editor-nav__group--done" : ""}`}
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
      {activeStep.tabs.length > 1 ? (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--color-border-tertiary, #e2e8f0)" }}
          role="tablist"
          aria-label="Panels in this step"
        >
          {activeStep.tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => onTabChange(t)}
              className="app-survey-simple-pill"
              style={{
                border: `1px solid ${tab === t ? "#0d9488" : "var(--color-border-tertiary, #e2e8f0)"}`,
                background: tab === t ? "#ccfbf1" : "#fff",
                color: tab === t ? "#115e59" : "var(--color-text-secondary)",
              }}
            >
              {SURVEY_TAB_PLAIN_LABELS[t] || t}
              {surveyTabIsComplete(report, t) ? " ✓" : ""}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default memo(SurveySimpleStepNav);
