import { useEffect, useState } from "react";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { buildLimitationsFromKeys } from "./surveyReportHelpers";

/**
 * Debounced, lazily loaded A4 preview HTML — only builds when preview is visible.
 * Dynamic-imports the print HTML builder so the heavy chunk loads on demand.
 */
export function useSurveyPreviewHtml(form, { active, ramsDocs, project, debounceMs = 650 }) {
  const debouncedForm = useDebouncedValue(active ? form : null, debounceMs);
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
        const { buildSurveyReportHtml } = await import("./surveyReportPrintHtml");
        if (cancelled) return;
        const linked = ramsDocs.find((d) => d.id === debouncedForm.linkedRamsId);
        const next = buildSurveyReportHtml(
          {
            ...debouncedForm,
            limitationsText:
              debouncedForm.limitationsText || buildLimitationsFromKeys(debouncedForm.limitationKeys),
          },
          {
            ramsTitle: linked?.title || linked?.documentNo || "",
            projectLat: project?.lat,
            projectLng: project?.lng,
          }
        );
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
  }, [active, debouncedForm, ramsDocs, project]);

  return { html, pending };
}
