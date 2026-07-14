/**
 * Next steps panel for People / Workers compliance.
 */
export default function PeopleNextSteps({ steps = [], onAction, onDismiss }) {
  if (!steps.length) return null;

  return (
    <div className="ptw-next-steps people-next-steps app-panel-surface" role="region" aria-label="Your next steps">
      <div className="ptw-next-steps__head">
        <div>
          <div className="ptw-next-steps__eyebrow">Your next step</div>
          <div className="ptw-next-steps__hint">Certifications, project assignment, and equipment checks in one place.</div>
        </div>
        {onDismiss ? (
          <button type="button" className="ptw-next-steps__dismiss" onClick={onDismiss} aria-label="Hide next steps for now">
            Hide
          </button>
        ) : null}
      </div>
      <ol className="ptw-next-steps__list">
        {steps.map((step, index) => (
          <li key={step.id} className={`ptw-next-steps__item ptw-next-steps__item--${step.tone || "accent"}`}>
            <div className="ptw-next-steps__num" aria-hidden>{index + 1}</div>
            <div className="ptw-next-steps__body">
              <strong className="ptw-next-steps__title">{step.title}</strong>
              <p className="ptw-next-steps__detail">{step.detail}</p>
            </div>
            <button type="button" className="ptw-next-steps__go" onClick={() => onAction?.(step.action, step)}>
              Go
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
