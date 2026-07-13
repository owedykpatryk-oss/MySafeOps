import { memo, useMemo } from "react";
import { getPas128WorkflowSteps, pas128MethodLabel } from "./pas128MethodPresets";

function Pas128WorkflowStrip({ methodKey, className = "" }) {
  const steps = useMemo(() => getPas128WorkflowSteps(methodKey), [methodKey]);
  if (!methodKey || !steps.length) return null;

  return (
    <div className={`app-survey-workflow-strip ${className}`.trim()} aria-label="PAS 128 survey workflow">
      <span className="app-survey-workflow-strip__label">{pas128MethodLabel(methodKey)}</span>
      <div className="app-survey-workflow-strip__track">
        {steps.map((step, i) => (
          <span key={`${step}-${i}`} className="app-survey-workflow-strip__step-wrap">
            {i > 0 ? <span className="app-survey-workflow-strip__arrow" aria-hidden="true">→</span> : null}
            <span className={`app-survey-workflow-strip__step${i === 0 ? " app-survey-workflow-strip__step--start" : ""}${i === steps.length - 1 ? " app-survey-workflow-strip__step--end" : ""}`}>
              {step}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(Pas128WorkflowStrip);
