import { memo } from "react";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { sanitizePrintPreviewHtml } from "../utils/htmlEscape.js";

/**
 * A4 print preview in iframe — RAMS, Survey, Permits.
 * Debounces srcDoc updates so heavy HTML rebuilds do not reload the iframe on every keystroke.
 */
function PrintPreviewFrame({
  html = "",
  title = "Print preview",
  height = 480,
  onPrint,
  printLabel = "Open print dialog",
  debounceMs = 450,
  responsive = true,
}) {
  const debouncedHtml = useDebouncedValue(html, debounceMs);
  const isPending = html !== debouncedHtml;
  const safeHtml = sanitizePrintPreviewHtml(debouncedHtml);

  if (!html && !debouncedHtml) {
    return (
      <div className="app-print-preview app-print-preview--empty" style={{ minHeight: Math.min(height, 200) }}>
        Save or complete required fields to see the A4 preview.
      </div>
    );
  }

  const previewClass = [
    "app-print-preview",
    responsive ? "app-print-preview--responsive" : "",
    isPending ? "app-print-preview--pending" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={previewClass} style={{ "--print-preview-h": `${height}px` }}>
      <div className="app-print-preview__toolbar">
        <span className="app-print-preview__label">
          {title}
          {isPending ? <span className="app-print-preview__pending"> — updating…</span> : null}
        </span>
        {onPrint ? (
          <button type="button" className="app-print-preview__print-btn" onClick={onPrint} disabled={isPending}>
            {printLabel}
          </button>
        ) : null}
      </div>
      <iframe
        title={title}
        srcDoc={safeHtml || "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:24px;color:#64748b'>Building preview…</body></html>"}
        className="app-print-preview__frame"
        sandbox="allow-same-origin allow-modals"
        loading="lazy"
      />
    </div>
  );
}

export default memo(PrintPreviewFrame);
