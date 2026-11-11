import { memo, useMemo } from "react";
import "../../styles/report-editor-nav.css";
import { GPR_SIMPLE_STEPS, GPR_TAB_PLAIN_LABELS, gprSimpleStepForTab } from "./gprSimpleEditorNav";
import { gprTabComplete } from "./gprReportEditorNav";

function GprSimpleStepNav({ tab, report, onTabChange }) {
  const activeStep = gprSimpleStepForTab(tab);

  const stepProgress = useMemo(() => {
    const out = {};
    GPR_SIMPLE_STEPS.forEach((step) => {
      const tabs = step.tabs || [];
      const done = tabs.filter((t) => gprTabComplete(report, t)).length;
      out[step.id] = { done, total: tabs.length, complete: done === tabs.length && tabs.length > 0 };
    });
    return out;
  }, [report]);

  return (
    <nav className="app-survey-editor-nav app-survey-editor-nav--simple" aria-label="GPR report steps">
      <div className="app-report-nav-heading">
        <span><strong>Report steps</strong> · Select a step to edit</span>
        <span>Step {GPR_SIMPLE_STEPS.findIndex((s) => s.id === activeStep.id) + 1} of {GPR_SIMPLE_STEPS.length}</span>
      </div>
      <div className="app-survey-editor-nav__groups">
        {GPR_SIMPLE_STEPS.map((step, index) => {
          const prog = stepProgress[step.id] || { done: 0, total: 1, complete: false };
          const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
          return (
            <button
              key={step.id}
              type="button"
              aria-current={activeStep.id === step.id ? "step" : undefined}
              className={`app-survey-editor-nav__group${activeStep.id === step.id ? " app-survey-editor-nav__group--active" : ""}${prog.complete ? " app-survey-editor-nav__group--done" : ""}`}
              onClick={() => onTabChange(step.tabs[0])}
            >
              <span className="app-survey-editor-nav__group-top">
                <span className="app-survey-editor-nav__group-label">
                  <span className="app-report-nav-number" aria-hidden="true">{index + 1}</span>
                  {step.label}
                </span>
                <span className={`app-survey-editor-nav__group-badge${prog.complete ? " app-survey-editor-nav__group-badge--done" : ""}`}>
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
          aria-label="Panels in this step"
        >
          {activeStep.tabs.map((t) => (
            <button
              key={t}
              type="button"
              aria-current={tab === t ? "page" : undefined}
              onClick={() => onTabChange(t)}
              className="app-survey-simple-pill"
              style={{
                border: `1px solid ${tab === t ? "#0d9488" : "var(--color-border-tertiary, #e2e8f0)"}`,
                background: tab === t ? "#ccfbf1" : "#fff",
                color: tab === t ? "#115e59" : "var(--color-text-secondary)",
              }}
            >
              {GPR_TAB_PLAIN_LABELS[t] || t}
              {gprTabComplete(report, t) ? " ✓" : ""}
            </button>
          ))}
        </div>
      ) : null}
    </nav>
  );
}

export default memo(GprSimpleStepNav);
