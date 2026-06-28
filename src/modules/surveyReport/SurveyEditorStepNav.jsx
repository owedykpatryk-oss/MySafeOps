import {
  SURVEY_EDITOR_GROUPS,
  SURVEY_EDITOR_TABS,
  surveyEditorGroupForTab,
} from "./surveyReportEditorNav";
import { surveyGroupCompletion, surveyTabIsComplete } from "./surveyReportListUtils";

export default function SurveyEditorStepNav({ tab, report, onTabChange }) {
  const activeGroup = surveyEditorGroupForTab(tab);

  return (
    <div className="app-survey-editor-nav">
      <div className="app-survey-editor-nav__groups" role="tablist" aria-label="Report sections">
        {SURVEY_EDITOR_GROUPS.map((g) => {
          const prog = surveyGroupCompletion(report, g.id);
          const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={activeGroup === g.id}
              className={`app-survey-editor-nav__group${activeGroup === g.id ? " app-survey-editor-nav__group--active" : ""}${prog.complete ? " app-survey-editor-nav__group--done" : ""}`}
              onClick={() => {
                const first = SURVEY_EDITOR_TABS.find((t) => t.group === g.id);
                if (first) onTabChange(first.id);
              }}
            >
              <span className="app-survey-editor-nav__group-top">
                <span className="app-survey-editor-nav__group-label">
                  {prog.complete ? <span className="app-survey-editor-nav__check" aria-hidden>✓</span> : null}
                  {g.label}
                </span>
                <span
                  className={`app-survey-editor-nav__group-badge${prog.complete ? " app-survey-editor-nav__group-badge--done" : ""}`}
                >
                  {prog.done}/{prog.total}
                </span>
              </span>
              <span className="app-survey-editor-nav__group-hint">{g.hint}</span>
              <span className="app-survey-editor-nav__group-meter" aria-hidden>
                <span className="app-survey-editor-nav__group-meter-fill" style={{ width: `${pct}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="app-survey-editor-nav__tabs">
        {SURVEY_EDITOR_TABS.filter((t) => t.group === activeGroup).map((t) => {
          const done = surveyTabIsComplete(report, t.id);
          return (
            <button
              key={t.id}
              type="button"
              className={`app-survey-editor-nav__tab${tab === t.id ? " app-survey-editor-nav__tab--active" : ""}${done ? " app-survey-editor-nav__tab--done" : ""}`}
              onClick={() => onTabChange(t.id)}
            >
              {done ? <span className="app-survey-editor-nav__tab-dot" aria-hidden /> : null}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
