import { buildRevisionTimeline, formatRevisionDate } from "./surveyReportRevision";

export default function SurveyRevisionTimeline({ report, allReports = [], onOpenReport }) {
  const { timeline, changes, parentRevision, parentReportId } = buildRevisionTimeline(report, allReports);

  if (!timeline.length && !changes.length) return null;

  return (
    <section className="app-survey-revision-timeline" aria-label="Revision timeline">
      <div className="app-survey-revision-timeline__head">
        <h3 className="app-survey-revision-timeline__title">Revision trail</h3>
        {parentReportId && onOpenReport ? (
          <button type="button" className="app-survey-revision-timeline__parent" onClick={() => onOpenReport(parentReportId)}>
            Open previous{parentRevision ? ` (Rev ${parentRevision})` : ""}
          </button>
        ) : null}
      </div>

      {timeline.length > 0 ? (
        <ol className="app-survey-revision-timeline__list">
          {timeline.map((item) => (
            <li
              key={item.id}
              className={`app-survey-revision-timeline__item${item.current ? " app-survey-revision-timeline__item--current" : ""}${item.status === "final" ? " app-survey-revision-timeline__item--final" : ""}`}
            >
              <span className="app-survey-revision-timeline__dot" aria-hidden />
              <div className="app-survey-revision-timeline__body">
                <div className="app-survey-revision-timeline__row">
                  <strong>Rev {item.revision}</strong>
                  <span>{formatRevisionDate(item.date)}</span>
                  {item.current ? <span className="app-survey-revision-timeline__badge">Current</span> : null}
                  {item.status === "final" && !item.current ? (
                    <span className="app-survey-revision-timeline__badge app-survey-revision-timeline__badge--final">Final</span>
                  ) : null}
                </div>
                <p>{item.description}</p>
                {item.author ? <span className="app-survey-revision-timeline__author">{item.author}</span> : null}
                {item.kind === "report" && onOpenReport ? (
                  <button type="button" className="app-survey-revision-timeline__link" onClick={() => onOpenReport(item.id)}>
                    Open report
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {changes.length > 0 ? (
        <div className="app-survey-revision-timeline__diff">
          <h4>Changes since {parentRevision ? `Rev ${parentRevision}` : "previous issue"}</h4>
          <ul>
            {changes.slice(0, 8).map((c, i) => (
              <li key={i}>
                <span className="app-survey-revision-timeline__field">{c.field}</span>
                <span className="app-survey-revision-timeline__arrow">
                  {c.before || "—"} → {c.after || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
