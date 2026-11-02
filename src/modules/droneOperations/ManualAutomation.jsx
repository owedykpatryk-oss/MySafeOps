import { manualReviewQueue, missingCompanyDetails, appendManualChangeSummary } from "./manualAutomation.js";

export function ManualReviewQueue({ manuals, disabled, onSelect }) {
  const queue = manualReviewQueue(manuals).filter((item) => !["current", "superseded"].includes(item.status));
  if (!manuals.length) return null;
  return (
    <section className="manual-automation-card" aria-label="Manual review queue">
      <div className="drone-toolbar">
        <div>
          <h3>Review planner</h3>
          <p>
            {queue.length
              ? `${queue.length} draft(s) or review(s) to follow up`
              : "No document reviews due in the next 30 days."}
          </p>
        </div>
        <span className="drone-note">Document control · next 30 days</span>
      </div>
      <div className="manual-review-queue">
        {queue.slice(0, 6).map(({ manual, status, label }) => (
          <button
            type="button"
            disabled={disabled}
            key={manual.id}
            className={`manual-review-tile ${status}`}
            onClick={() => onSelect(manual.id)}
          >
            <small>{label}</small>
            <strong>
              {manual.title} · {manual.version}
            </strong>
            <span>
              {manual.documentCode || "Document code needed"} ·{" "}
              {manual.documentOwner || manual.author || "Owner needed"}
            </span>
          </button>
        ))}
      </div>
      {queue.length > 6 && (
        <p className="drone-note">Use the version selector below for the remaining {queue.length - 6} items.</p>
      )}
    </section>
  );
}
export function ManualAutomationTools({ manual, companySettings, comparison, canEdit, onUpdate }) {
  const suggestions = missingCompanyDetails(manual, companySettings);
  return (
    <section className="drone-card manual-automation-tools" aria-label="Manual automation">
      <h3>Less retyping, clearer revisions</h3>
      {canEdit && !manual.approvedAt && (
        <div>
          <h4>From your company profile</h4>
          {suggestions.length ? (
            <>
              <ul>
                {suggestions.map((s) => (
                  <li key={s.key}>
                    <strong>{s.label}:</strong> {s.value}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    company: { ...manual.company, ...Object.fromEntries(suggestions.map((s) => [s.key, s.value])) },
                  })
                }
              >
                Fill missing company details
              </button>
              <p className="drone-note">
                Fills only the empty fields shown above. Check the operator chapter again after applying.
              </p>
            </>
          ) : (
            <p className="drone-note">No missing fields can be filled from your current company profile.</p>
          )}
        </div>
      )}
      {manual.previousId ? (
        comparison ? (
          <div>
            <h4>Changes since version {comparison.baseVersion}</h4>
            {comparison.items.length ? (
              <ul>
                {comparison.items.map((item) => (
                  <li key={item.key}>{item.label}</li>
                ))}
              </ul>
            ) : (
              <p>No procedure or document-control changes detected yet.</p>
            )}
            {canEdit && !manual.approvedAt && (
              <button
                type="button"
                disabled={!comparison.items.length}
                onClick={() => onUpdate({ changeNote: appendManualChangeSummary(manual, comparison) })}
              >
                Append change summary
              </button>
            )}
            <p className="drone-note">
              Lists changed fields and chapters. Add the reason for each change and confirm the details.
            </p>
          </div>
        ) : (
          <p className="drone-note">
            The earlier reviewed version is unavailable in this workspace. Record and verify the amendment manually.
          </p>
        )
      ) : (
        <p className="drone-note">Revision comparison appears when you create a revision of a reviewed manual.</p>
      )}
    </section>
  );
}
