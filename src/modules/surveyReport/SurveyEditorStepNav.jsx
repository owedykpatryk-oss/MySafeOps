import { SURVEY_EDITOR_GROUPS, SURVEY_EDITOR_TABS, surveyEditorGroupForTab } from "./surveyReportEditorNav";

export default function SurveyEditorStepNav({ tab, onTabChange }) {
  const activeGroup = surveyEditorGroupForTab(tab);

  return (
    <div className="app-survey-editor-nav">
      <div className="app-survey-editor-nav__groups" role="tablist" aria-label="Report sections">
        {SURVEY_EDITOR_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={activeGroup === g.id}
            className={`app-survey-editor-nav__group${activeGroup === g.id ? " app-survey-editor-nav__group--active" : ""}`}
            onClick={() => {
              const first = SURVEY_EDITOR_TABS.find((t) => t.group === g.id);
              if (first) onTabChange(first.id);
            }}
          >
            <span className="app-survey-editor-nav__group-label">{g.label}</span>
            <span className="app-survey-editor-nav__group-hint">{g.hint}</span>
          </button>
        ))}
      </div>
      <div className="app-survey-editor-nav__tabs">
        {SURVEY_EDITOR_TABS.filter((t) => t.group === activeGroup).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`app-survey-editor-nav__tab${tab === t.id ? " app-survey-editor-nav__tab--active" : ""}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
