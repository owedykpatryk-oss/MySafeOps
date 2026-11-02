import { useEffect, useRef } from "react";
import { nextMissionStep, closeoutSummary, documentQuality } from "./missionWorkflow.js";

export function MissionNextStep({ mission, actions, definitions, at, onNavigate, onExport, busy }) {
  const next = nextMissionStep(mission, actions, definitions, at);
  return (
    <section className="mission-next-step" aria-label="Suggested next step">
      <div>
        <p className="field-eyebrow">WHAT'S NEXT · {next.phase.toUpperCase()}</p>
        <h2>{next.title}</h2>
        <p>{next.detail}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => (next.exportKind ? onExport(next.exportKind) : onNavigate(next.section))}
      >
        {next.label}
        <span aria-hidden="true"> →</span>
      </button>
    </section>
  );
}
export function CloseoutReview({ mission, definitions, at, onNavigate, onExport, busy }) {
  const summary = closeoutSummary(mission, definitions, at);
  if (summary.state !== "closed") return null;
  return (
    <section className="drone-card mission-closeout" aria-labelledby="closeout-title">
      <div className="field-section-head">
        <div>
          <p className="field-eyebrow">AUTOMATIC CLOSE-OUT REVIEW</p>
          <h2 id="closeout-title">Bring the site record together</h2>
        </div>
        <button type="button" disabled={busy} onClick={() => onExport("closeout")}>
          Review close-out PDF
        </button>
      </div>
      <p>
        Built from recorded session events and checks. Closing the session does not confirm survey completion or client
        acceptance.
      </p>
      <dl className="closeout-facts">
        <div>
          <dt>Active site session</dt>
          <dd>{summary.activeMinutes} min</dd>
        </div>
        <div>
          <dt>Recorded pauses</dt>
          <dd>
            {summary.pauses.length} <small>· {summary.pausedMinutes} min</small>
          </dd>
        </div>
        <div>
          <dt>Post-operation reviews</dt>
          <dd>
            {summary.postRecorded} / {summary.postTotal}
          </dd>
        </div>
      </dl>
      <small>Session duration is not flight time. Times come from recorded events.</small>
      <h3>Closing note</h3>
      <p className="field-preserve">{summary.closingNote || "Not recorded"}</p>
      <div className="drone-actions">
        <button type="button" onClick={() => onNavigate("checklist")}>
          Review post-operation checks
        </button>
        <button type="button" onClick={() => onNavigate("documents")}>
          Open document package
        </button>
      </div>
    </section>
  );
}
export function ExportReviewDialog({ review, busy, onClose, onConfirm, onFix }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const returnFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (returnFocus?.isConnected && typeof returnFocus.focus === "function")
        returnFocus.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    dialog.scrollTop = 0;
    dialog.querySelector("#export-review-title")?.focus({ preventScroll: true });
  }, [review.issue]);
  const findings = documentQuality(review.issue.snapshot, { at: Date.parse(review.issue.issuedAt) });
  const item = (finding) => (
    <li key={finding.id}>
      <div>
        <strong>{finding.title}</strong>
        <p>{finding.detail}</p>
      </div>
      <button type="button" disabled={busy} onClick={() => onFix(finding.section)}>
        Review item
      </button>
    </li>
  );
  return (
    <dialog
      ref={ref}
      className="drone-export-dialog"
      aria-labelledby="export-review-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="field-section-head">
        <div>
          <p className="field-eyebrow">BEFORE YOU EXPORT · PLAN R{review.issue.snapshot.revision}</p>
          <h2 id="export-review-title" tabIndex={-1}>
            Review your draft export
          </h2>
        </div>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Close export review">
          ×
        </button>
      </div>
      {review.notice && (
        <p role="status" className="drone-warning">
          {review.notice}
        </p>
      )}
      <p>
        <strong>
          {findings.length ? `${findings.length} review item(s) remain` : "No document inconsistencies detected"}
        </strong>
        . These checks do not grant flight approval or confirm that survey deliverables are complete.
      </p>
      <p>
        {review.issue.snapshot.title} ·{" "}
        {review.kind === "bundle"
          ? "Seven PDFs and a briefing request, plus KML when mapped areas are available"
          : review.kind === "closeout"
            ? "Site close-out draft"
            : "Draft document"}
      </p>
      {findings.length > 0 && (
        <>
          <ul className="export-review-items">{findings.slice(0, 5).map(item)}</ul>
          {findings.length > 5 && (
            <details>
              <summary>Show {findings.length - 5} more review items</summary>
              <ul className="export-review-items">{findings.slice(5).map(item)}</ul>
            </details>
          )}
        </>
      )}
      <p className="drone-note">
        You can export a draft with outstanding items. Findings are included in the full draft, field card and close-out
        record. Issued snapshots are kept separately.
      </p>
      <div className="drone-actions export-review-footer">
        <button type="button" disabled={busy} onClick={onClose}>
          Keep editing
        </button>
        <button type="button" className="drone-primary" disabled={busy} onClick={onConfirm}>
          Export this draft
        </button>
      </div>
    </dialog>
  );
}
