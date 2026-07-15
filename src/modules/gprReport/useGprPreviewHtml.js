import { useEffect, useState } from "react";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { sanitizePrintPreviewHtml } from "../../utils/htmlEscape.js";

/**
 * Debounced GPR A4 preview — only builds when the preview dock is open.
 * Dynamically imports print HTML so the heavy builder is not on the critical path.
 */
export function useGprPreviewHtml(form, extras, { active, debounceMs = 500 } = {}) {
  const debouncedForm = useDebouncedValue(active ? form : null, debounceMs);
  const debouncedExtras = useDebouncedValue(active ? extras : null, debounceMs);
  const [html, setHtml] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!active || !debouncedForm) {
      setHtml("");
      setPending(false);
      return undefined;
    }

    let cancelled = false;
    setPending(true);

    (async () => {
      try {
        const { buildGprReportHtml } = await import("./gprReportPrintHtml");
        if (cancelled) return;
        const next = sanitizePrintPreviewHtml(buildGprReportHtml(debouncedForm, debouncedExtras || {}));
        if (!cancelled) setHtml(next);
      } catch {
        if (!cancelled) setHtml("");
      } finally {
        if (!cancelled) setPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, debouncedForm, debouncedExtras]);

  return { html, pending };
}
