import SurveyProgressRing from "../surveyReport/SurveyProgressRing";

export default function GprListStatsBar({ summary }) {
  if (!summary?.total) return null;
  const finalPct = summary.total ? Math.round((summary.finals / summary.total) * 100) : 0;

  return (
    <div className="app-survey-list-stats app-survey-list-stats--visual app-gpr-list-stats">
      <SurveyProgressRing value={summary.avgComplete} size={56} stroke={5} sublabel="avg" className="app-survey-list-stats__ring" />
      <div className="app-survey-list-stats__grid">
        <div className="app-survey-list-stats__tile">
          <strong>{summary.total}</strong>
          <span>GPR reports</span>
        </div>
        <div className="app-survey-list-stats__tile">
          <strong>{summary.withGeology}</strong>
          <span>BGS enriched</span>
        </div>
        <div className="app-survey-list-stats__tile app-survey-list-stats__tile--final">
          <strong>{summary.finals}</strong>
          <span>Final</span>
        </div>
        {summary.needsWork > 0 ? (
          <div className="app-survey-list-stats__tile app-survey-list-stats__tile--warn">
            <strong>{summary.needsWork}</strong>
            <span>Need work</span>
          </div>
        ) : (
          <div className="app-survey-list-stats__tile app-survey-list-stats__tile--ok">
            <strong>✓</strong>
            <span>On track</span>
          </div>
        )}
      </div>
      <div className="app-survey-list-stats__meter" aria-hidden>
        <div className="app-survey-list-stats__meter-label">
          <span>Finalised</span>
          <span>{finalPct}%</span>
        </div>
        <div className="app-survey-list-stats__meter-track">
          <div className="app-survey-list-stats__meter-fill" style={{ width: `${finalPct}%` }} />
        </div>
      </div>
    </div>
  );
}
