import { GPR_EDITOR_TABS, gprTabComplete, gprOverallTabProgress } from "./gprReportEditorNav";
import "../../styles/report-editor-nav.css";

const HINTS = {
  setup: "Job details & location",
  equipment: "Equipment & acquisition",
  ground: "Ground & environment",
  findings: "Results, scans & photos",
  narrative: "Method & limitations",
  qa: "Review & print",
};

export default function GprEditorStepNav({ tab, report, onTabChange, tabs = GPR_EDITOR_TABS }) {
  const progress = gprOverallTabProgress(report);
  return (
    <nav className="app-gpr-step-nav" aria-label="GPR report sections">
      <div className="app-report-nav-heading">
        <span><strong>Report sections</strong> · Select a section to edit</span>
        <span>{progress.done}/{progress.total} sections filled in</span>
      </div>
      <div className="app-gpr-step-nav__grid">
        {tabs.map((section, index) => {
          const done = gprTabComplete(report, section.id);
          const active = tab === section.id;
          return (
            <button key={section.id} type="button" onClick={() => onTabChange(section.id)}
              aria-current={active ? "step" : undefined}
              className={`app-gpr-step-nav__step${active ? " app-gpr-step-nav__step--active" : ""}`}>
              <span className="app-report-nav-number" aria-hidden="true">{index + 1}</span>
              <span className="app-gpr-step-nav__text">
                <strong>{section.label}</strong>
                <span>{HINTS[section.id]}</span>
                <small>{active ? "Editing" : done ? "Filled in · review before issue" : "Open section"}</small>
              </span>
              {done ? <span className="app-gpr-step-nav__check" aria-label="Section filled in">✓</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
