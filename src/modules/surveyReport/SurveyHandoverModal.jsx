import { memo, useEffect, useState } from "react";
import SurveyIssueCelebration from "./SurveyIssueCelebration";
import { pas128MethodLabel } from "./pas128MethodPresets";

/** Post-final handover modal — download ZIP, print, append to RAMS. */
function SurveyHandoverModal({
  open,
  celebrate = false,
  report,
  linkedRams,
  packBusy = false,
  packProgress = "",
  onClose,
  onDownloadPack,
  onPrint,
  onAppendRams,
}) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!open || !celebrate) return undefined;
    setShowConfetti(true);
    const t = window.setTimeout(() => setShowConfetti(false), 3200);
    return () => window.clearTimeout(t);
  }, [open, celebrate]);

  if (!open || !report) return null;

  const utilCount = (report.utilitiesTable || []).length;
  const ql = report.pas128Ql || "—";
  const method = report.pas128Method ? pas128MethodLabel(report.pas128Method) : null;

  return (
    <>
      <SurveyIssueCelebration active={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="app-survey-handover" role="dialog" aria-modal="true" aria-labelledby="survey-handover-title">
        <button type="button" className="app-survey-handover__backdrop" aria-label="Close" onClick={onClose} />
        <div className="app-survey-handover__panel">
          <div className="app-survey-handover__badge">Issued</div>
          <h2 id="survey-handover-title" className="app-survey-handover__title">
            Report ready for handover
          </h2>
          <p className="app-survey-handover__ref">{report.ref || report.title || "Survey report"}</p>

          <dl className="app-survey-handover__stats">
            <div>
              <dt>PAS 128 QL</dt>
              <dd>{ql}</dd>
            </div>
            {method ? (
              <div>
                <dt>Method</dt>
                <dd>{method}</dd>
              </div>
            ) : null}
            <div>
              <dt>Utilities</dt>
              <dd>{utilCount}</dd>
            </div>
          </dl>

          <p className="app-survey-handover__hint">
            Download one ZIP with PDF, HTML, utility schedule CSV, and README manifest.
          </p>

          <div className="app-survey-handover__actions">
            <button
              type="button"
              className="app-survey-handover__btn app-survey-handover__btn--primary"
              disabled={packBusy}
              onClick={onDownloadPack}
            >
              {packBusy ? packProgress || "Building pack…" : "Download handover ZIP"}
            </button>
            <button type="button" className="app-survey-handover__btn" onClick={onPrint}>
              Print preview
            </button>
            {linkedRams ? (
              <button type="button" className="app-survey-handover__btn" onClick={onAppendRams}>
                Append to RAMS
              </button>
            ) : null}
            <button type="button" className="app-survey-handover__btn app-survey-handover__btn--ghost" onClick={onClose}>
              Continue editing
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(SurveyHandoverModal);
