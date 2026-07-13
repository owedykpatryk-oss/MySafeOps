import { memo, useMemo } from "react";
import StatusChip from "../../components/StatusChip";
import { getSurveyStatusMeta } from "../../utils/statusChipMeta";
import SurveyProgressRing from "../surveyReport/SurveyProgressRing";
import { gprReportQuality, gprStaticMapUrl } from "./gprReportHelpers";
import { gprEvidenceStats } from "./gprReportPulse";
import { firstIncompleteGprTab, GPR_EDITOR_TABS, gprOverallTabProgress } from "./gprReportEditorNav";
import GprWaveBackdrop from "./GprWaveBackdrop";

function GprEditorHero({ form, project, onClose, onGoToTab, livePreviewOpen, onToggleLivePreview, onMarkFinal }) {
  const quality = useMemo(() => gprReportQuality(form), [form]);
  const steps = useMemo(() => gprOverallTabProgress(form), [form]);
  const nextTab = useMemo(() => firstIncompleteGprTab(form), [form]);
  const evidence = useMemo(() => gprEvidenceStats(form), [form]);
  const mapUrl = useMemo(() => gprStaticMapUrl(project?.lat, project?.lng), [project?.lat, project?.lng]);
  const freq = form.equipment?.[0]?.antennaFrequencyMhz;
  const pen = form.groundConditions?.expectedPenetrationM;
  const readyToFinal = quality.score >= 80 && form.status !== "final";

  return (
    <header className={`app-survey-editor-hero app-gpr-editor-hero${readyToFinal ? " app-survey-editor-hero--ready app-gpr-editor-hero--ready" : ""}`}>
      <GprWaveBackdrop />
      <div className="app-survey-editor-hero__main">
        {mapUrl ? (
          <div className="app-survey-editor-hero__map">
            <img src={mapUrl} alt="" loading="lazy" />
          </div>
        ) : null}
        <div className="app-survey-editor-hero__copy">
          <div className="app-survey-editor-hero__eyebrow">
            GPR report
            {form.ref ? <span className="app-survey-editor-hero__ref">{form.ref}</span> : null}
            {freq ? <span className="app-gpr-hero-chip">{freq} MHz</span> : null}
            {pen != null ? <span className="app-gpr-hero-chip app-gpr-hero-chip--pen">~{pen} m pen.</span> : null}
          </div>
          <h2 className="app-survey-editor-hero__title">{form.title?.trim() || "New GPR report"}</h2>
          <div className="app-survey-editor-hero__meta">
            <StatusChip meta={getSurveyStatusMeta(form.status)} size="md" />
            {form.surveyDate ? <span>{form.surveyDate}</span> : null}
            {form.surveyor ? <span>{form.surveyor}</span> : null}
            {project?.name ? <span>{project.name}</span> : null}
          </div>
          {readyToFinal ? (
            <p className="app-survey-editor-hero__ready">Ready to mark final — review live preview then sign off.</p>
          ) : (
            <p className="app-survey-editor-hero__hint">
              {form.status === "final" ? "Final issue" : "Complete each tab — BGS geology and weather enrich automatically"}
            </p>
          )}
          <div className="app-gpr-hero-stats">
            {evidence.radargrams ? <span className="app-gpr-hero-stat">{evidence.radargrams} radargram{evidence.radargrams !== 1 ? "s" : ""}</span> : null}
            {evidence.panels ? <span className="app-gpr-hero-stat">{evidence.panels} panel{evidence.panels !== 1 ? "s" : ""}</span> : null}
            {evidence.anomalies ? <span className="app-gpr-hero-stat">{evidence.anomalies} anomal{evidence.anomalies !== 1 ? "ies" : "y"}</span> : null}
            {evidence.filtersApplied ? <span className="app-gpr-hero-stat">{evidence.filtersApplied} filters</span> : null}
          </div>
        </div>
        <SurveyProgressRing value={quality.score} size={84} stroke={7} sublabel={`${steps.done}/${steps.total} tabs`} />
      </div>

      <div className="app-survey-editor-hero__quality">
        <div className="app-survey-editor-hero__quality-bar">
          <div className="app-survey-editor-hero__quality-fill" style={{ width: `${quality.score}%` }} />
        </div>
        {quality.missing.length > 0 ? (
          <p className="app-survey-editor-hero__missing">
            Still needed: {quality.missing.slice(0, 4).join(" · ")}
            {quality.missing.length > 4 ? ` · +${quality.missing.length - 4} more` : ""}
          </p>
        ) : (
          <p className="app-survey-editor-hero__missing app-survey-editor-hero__missing--done">All quality checks passed</p>
        )}
        {nextTab && onGoToTab ? (
          <button type="button" className="app-survey-quality-next" onClick={() => onGoToTab(nextTab)}>
            Continue: {GPR_EDITOR_TABS.find((t) => t.id === nextTab)?.label || nextTab}
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
        {readyToFinal && onMarkFinal ? (
          <button type="button" className="app-gpr-mark-final-btn" onClick={onMarkFinal}>
            Mark as final
          </button>
        ) : null}
      </div>

      <button type="button" className="app-survey-editor-hero__close" onClick={onClose} aria-label="Close editor">
        ×
      </button>
    </header>
  );
}

export default memo(GprEditorHero);
