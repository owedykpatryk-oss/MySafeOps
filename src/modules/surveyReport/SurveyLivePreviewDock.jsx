import PrintPreviewFrame from "../../components/PrintPreviewFrame";

/** Docked live A4 preview — toggles beside the editor form. */
export default function SurveyLivePreviewDock({
  open,
  onToggle,
  html,
  onPrint,
  height = 480,
  qualityScore,
  exportReady,
}) {
  if (!open) {
    return (
      <button type="button" className="app-survey-live-preview-fab" onClick={() => onToggle(true)} title="Show live preview (Ctrl+Shift+P)">
        <span aria-hidden>📄</span> Live preview
        {typeof qualityScore === "number" ? (
          <span className="app-survey-live-preview-fab__score">{qualityScore}%</span>
        ) : null}
      </button>
    );
  }

  return (
    <aside className="app-survey-live-preview-dock" aria-label="Live print preview">
      <div className="app-survey-live-preview-dock__head">
        <span>Live A4 preview</span>
        <div className="app-survey-live-preview-dock__meta">
          {typeof qualityScore === "number" ? (
            <span className={`app-survey-live-preview-dock__score${qualityScore >= 80 ? " app-survey-live-preview-dock__score--ready" : ""}`}>
              {qualityScore}% complete
            </span>
          ) : null}
          {exportReady === true ? (
            <span className="app-survey-live-preview-dock__export app-survey-live-preview-dock__export--ok">Pack ready</span>
          ) : exportReady === false ? (
            <span className="app-survey-live-preview-dock__export">Pack incomplete</span>
          ) : null}
        </div>
        <button type="button" className="app-survey-live-preview-dock__close" onClick={() => onToggle(false)}>
          Hide
        </button>
      </div>
      <PrintPreviewFrame
        html={html}
        title="Survey report"
        height={height}
        onPrint={onPrint}
        printLabel="Print"
        debounceMs={500}
      />
    </aside>
  );
}
