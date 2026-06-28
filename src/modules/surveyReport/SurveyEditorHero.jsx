import { memo, useMemo } from "react";
import StatusChip from "../../components/StatusChip";
import { getSurveyStatusMeta } from "../../utils/statusChipMeta";
import { surveyReportQuality, surveyStaticMapThumbUrl, surveyTypeLabel } from "./surveyReportHelpers";
import SurveyProgressRing from "./SurveyProgressRing";
import { firstIncompleteSurveyTab, surveyOverallTabProgress } from "./surveyReportListUtils";
import { SURVEY_EDITOR_TABS } from "./surveyReportEditorNav";

function SurveyEditorHero({
  form,
  project,
  onClose,
  onGoToTab,
  livePreviewOpen,
  onToggleLivePreview,
}) {
  const quality = useMemo(() => surveyReportQuality(form), [form]);
  const steps = useMemo(() => surveyOverallTabProgress(form), [form]);
  const nextTab = useMemo(() => firstIncompleteSurveyTab(form), [form]);
  const mapUrl = useMemo(
    () => surveyStaticMapThumbUrl(project?.lat, project?.lng),
    [project?.lat, project?.lng]
  );
  const readyToFinal = quality.score >= 80 && form.status !== "final";

  return (
    <header className={`app-survey-editor-hero${readyToFinal ? " app-survey-editor-hero--ready" : ""}`}>
      <div className="app-survey-editor-hero__main">
        {mapUrl ? (
          <div className="app-survey-editor-hero__map">
            <img src={mapUrl} alt="" loading="lazy" />
          </div>
        ) : null}
        <div className="app-survey-editor-hero__copy">
          <div className="app-survey-editor-hero__eyebrow">
            {form.surveyType ? surveyTypeLabel(form.surveyType) : "Survey report"}
            {form.ref ? <span className="app-survey-editor-hero__ref">{form.ref}</span> : null}
          </div>
          <h2 className="app-survey-editor-hero__title">{form.title?.trim() || "New survey report"}</h2>
          <div className="app-survey-editor-hero__meta">
            <StatusChip meta={getSurveyStatusMeta(form.status)} size="md" />
            {form.surveyDate ? <span>{form.surveyDate}</span> : null}
            {form.surveyor ? <span>{form.surveyor}</span> : null}
            {project?.name ? <span>{project.name}</span> : null}
          </div>
          {readyToFinal ? (
            <p className="app-survey-editor-hero__ready">Ready to mark final — review print preview then sign off.</p>
          ) : (
            <p className="app-survey-editor-hero__hint">
              {form.status === "final"
                ? "Final issue — fields lock on save"
                : "Complete each section — progress saves automatically"}
            </p>
          )}
        </div>
        <SurveyProgressRing
          value={quality.score}
          size={84}
          stroke={7}
          sublabel={`${steps.done}/${steps.total} steps`}
        />
      </div>

      <div className="app-survey-editor-hero__quality">
        <div className="app-survey-editor-hero__quality-bar">
          <div
            className="app-survey-editor-hero__quality-fill"
            style={{ width: `${quality.score}%` }}
          />
        </div>
        {quality.missing.length > 0 ? (
          <p className="app-survey-editor-hero__missing">
            Still needed: {quality.missing.slice(0, 4).join(" · ")}
            {quality.missing.length > 4 ? ` · +${quality.missing.length - 4} more` : ""}
          </p>
        ) : (
          <p className="app-survey-editor-hero__missing app-survey-editor-hero__missing--done">
            All quality checks passed
          </p>
        )}
        {nextTab && onGoToTab ? (
          <button type="button" className="app-survey-quality-next" onClick={() => onGoToTab(nextTab)}>
            Continue: {SURVEY_EDITOR_TABS.find((t) => t.id === nextTab)?.label || nextTab}
          </button>
        ) : null}
        {onToggleLivePreview ? (
          <button
            type="button"
            className={`app-survey-live-preview-toggle${livePreviewOpen ? " app-survey-live-preview-toggle--on" : ""}`}
            onClick={() => onToggleLivePreview(!livePreviewOpen)}
          >
            {livePreviewOpen ? "Hide live preview" : "Show live preview"}
          </button>
        ) : null}
      </div>

      <button type="button" className="app-survey-editor-hero__close" onClick={onClose} aria-label="Close editor">
        ×
      </button>
    </header>
  );
}

export default memo(SurveyEditorHero);
