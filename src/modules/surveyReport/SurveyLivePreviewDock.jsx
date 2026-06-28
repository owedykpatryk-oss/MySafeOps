import PrintPreviewFrame from "../../components/PrintPreviewFrame";

/** Docked live A4 preview — toggles beside the editor form. */
export default function SurveyLivePreviewDock({ open, onToggle, html, onPrint, height = 480 }) {
  if (!open) {
    return (
      <button type="button" className="app-survey-live-preview-fab" onClick={() => onToggle(true)} title="Show live preview (Ctrl+Shift+P)">
        <span aria-hidden>📄</span> Live preview
      </button>
    );
  }

  return (
    <aside className="app-survey-live-preview-dock" aria-label="Live print preview">
      <div className="app-survey-live-preview-dock__head">
        <span>Live A4 preview</span>
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
