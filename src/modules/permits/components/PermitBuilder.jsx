import { useEffect, useId, useRef } from "react";
import PermitStepper from "./PermitStepper";
import ModuleOverlay from "../../../components/ModuleOverlay";
import PrintPreviewFrame from "../../../components/PrintPreviewFrame";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function PermitBuilder({ title, onClose, step = 1, children, previewHtml }) {
  const wide = Boolean(previewHtml);
  const titleId = useId();
  const panelRef = useRef(null);
  const lastFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    lastFocusRef.current = document.activeElement;
    const panel = panelRef.current;
    if (!panel) return undefined;

    const focusables = () => Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));

    const first = focusables()[0];
    if (first) first.focus();
    else panel.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables().filter((el) => el.getClientRects().length > 0);
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl || !panel.contains(document.activeElement)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      try {
        if (typeof lastFocusRef.current?.focus === "function") lastFocusRef.current.focus();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <ModuleOverlay>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`app-module-overlay__panel${wide ? " app-module-overlay__panel--wide" : ""}`}
        style={{
          background: "var(--color-background-primary,#fff)",
          borderRadius: "var(--radius-sm,10px)",
          border: "1px solid var(--color-border-tertiary,#e5e5e5)",
          boxShadow: "var(--shadow-sm)",
          padding: 16,
          outline: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div id={titleId} style={{ fontWeight: 500, fontSize: 16 }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-secondary,#f7f7f5)", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
        <PermitStepper current={step} />
        <div style={{ display: wide ? "grid" : "block", gridTemplateColumns: wide ? "minmax(0,1fr) minmax(0,1fr)" : undefined, gap: 16, alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>{children}</div>
          {wide && previewHtml ? (
            <div className="app-doc-preview-sticky">
              <PrintPreviewFrame
                html={previewHtml}
                title="Live permit preview"
                height={460}
                responsive
              />
            </div>
          ) : null}
        </div>
      </div>
    </ModuleOverlay>
  );
}
