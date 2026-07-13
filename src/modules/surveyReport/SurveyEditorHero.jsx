import { memo, useMemo } from "react";
import StatusChip from "../../components/StatusChip";
import { getSurveyStatusMeta } from "../../utils/statusChipMeta";
import { surveyReportQuality, surveyStaticMapThumbUrl, surveyTypeLabel, buildPas128SummaryStats, surveyTypeChipTone } from "./surveyReportHelpers";
import SurveyProgressRing from "./SurveyProgressRing";
import SurveyPas128Donut from "./SurveyPas128Donut";
import SurveyMilestoneStrip from "./SurveyMilestoneStrip";
import Pas128WorkflowStrip from "./Pas128WorkflowStrip";
import { pas128MethodLabel } from "./pas128MethodPresets";
import { firstIncompleteSurveyTab, surveyOverallTabProgress } from "./surveyReportListUtils";
import { SURVEY_EDITOR_TABS } from "./surveyReportEditorNav";
import { getQaChecklistProgress } from "./surveyQaPack";

function SurveyEditorHero({
  form,
  project,
  onClose,
  onGoToTab,
  livePreviewOpen,
  onToggleLivePreview,
}) {
  const quality = useMemo(() => surveyReportQuality(form), [form]);
  const qaProgress = useMemo(() => getQaChecklistProgress(form?.qaChecklist, form?.surveyType), [form?.qaChecklist, form?.surveyType]);
  const steps = useMemo(() => surveyOverallTabProgress(form), [form]);
  const nextTab = useMemo(() => firstIncompleteSurveyTab(form), [form]);
  const mapUrl = useMemo(
    () => surveyStaticMapThumbUrl(project?.lat, project?.lng),
    [project?.lat, project?.lng]
  );
  const isFinal = form.status === "final";
  const readyToFinal = quality.score >= 80 && qaProgress.pct >= 50 && !isFinal;
  const pas128Stats = useMemo(
    () =>
      ["utility_mapping_survey", "eml_cat_survey", "gpr_survey"].includes(form.surveyType)
        ? buildPas128SummaryStats(form)
        : null,
    [form]
  );
  const typeTone = surveyTypeChipTone(form.surveyType);

  return (
    <header
      className={`app-survey-editor-hero${readyToFinal ? " app-survey-editor-hero--ready" : ""}${qaProgress.complete ? " app-survey-editor-hero--qa-done" : ""}${isFinal ? " app-survey-editor-hero--final" : ""}`}
    >
      <div className="app-survey-editor-hero__main">
        {mapUrl ? (
          <div className="app-survey-editor-hero__map app-survey-editor-hero__map--live">
            <img src={mapUrl} alt="" loading="lazy" />
            <span className="app-survey-editor-hero__map-pin" aria-hidden />
          </div>
        ) : null}
        <div className="app-survey-editor-hero__copy">
          <div className="app-survey-editor-hero__eyebrow">
            {form.surveyType ? (
              <span className={`app-survey-type-chip app-survey-type-chip--${typeTone}`}>{surveyTypeLabel(form.surveyType)}</span>
            ) : (
              "Survey report"
            )}
            {form.pas128Method ? (
              <span className="app-survey-editor-hero__method">{pas128MethodLabel(form.pas128Method)}</span>
            ) : null}
            {form.ref ? <span className="app-survey-editor-hero__ref">{form.ref}</span> : null}
            {isFinal ? <span className="app-survey-issued-badge">Issued</span> : null}
          </div>
          <h2 className="app-survey-editor-hero__title">{form.title?.trim() || "New survey report"}</h2>
          <div className="app-survey-editor-hero__meta">
            <StatusChip meta={getSurveyStatusMeta(form.status)} size="md" />
            {form.surveyDate ? <span>{form.surveyDate}</span> : null}
            {form.surveyor ? <span>{form.surveyor}</span> : null}
            {project?.name ? <span>{project.name}</span> : null}
          </div>
          <SurveyMilestoneStrip report={form} onGoToTab={onGoToTab} />
          {isFinal ? (
            <p className="app-survey-editor-hero__ready">Final issue — report ready for client handover pack.</p>
          ) : qaProgress.complete ? (
            <p className="app-survey-editor-hero__ready">QA checklist complete — all verification steps ticked.</p>
          ) : readyToFinal ? (
            <p className="app-survey-editor-hero__ready">Ready to mark final — review print preview then sign off.</p>
          ) : (
            <p className="app-survey-editor-hero__hint">
              Complete each section — QA {qaProgress.checked}/{qaProgress.total} ({qaProgress.pct}%)
            </p>
          )}
        </div>
        {form.pas128Method ? <Pas128WorkflowStrip methodKey={form.pas128Method} className="app-survey-workflow-strip--hero" /> : null}
        <div className="app-survey-editor-hero__rings">
          {pas128Stats?.total ? (
            <SurveyPas128Donut byQl={pas128Stats.byQl} size={76} stroke={10} centerSub="utils" />
          ) : null}
          {form.surveyType ? (
            <SurveyProgressRing
              value={qaProgress.pct}
              size={72}
              stroke={6}
              sublabel="QA"
              className="app-survey-progress-ring--qa"
            />
          ) : null}
          <SurveyProgressRing
            value={quality.score}
            size={84}
            stroke={7}
            sublabel={`${steps.done}/${steps.total} steps`}
          />
        </div>
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
