import { memo } from "react";
import SurveyPas128Donut from "./SurveyPas128Donut";
import { PAS128_QL_COLORS, CONFIDENCE_COLORS, confidenceLabel } from "./surveyPas128Visual";

function SurveyPas128Dashboard({ stats, compact = false }) {
  if (!stats?.total) return null;

  return (
    <div className={`app-survey-pas128-dashboard${compact ? " app-survey-pas128-dashboard--compact" : ""}`}>
      <SurveyPas128Donut byQl={stats.byQl} size={compact ? 72 : 96} stroke={compact ? 11 : 14} centerSub="utilities" />
      <div className="app-survey-pas128-dashboard__body">
        <div className="app-survey-pas128-dashboard__title">PAS128 utility schedule</div>
        <div className="app-survey-pas128-dashboard__stats">
          <span>
            <strong>{stats.withDepth}</strong> with depth
          </span>
          <span>
            <strong>{stats.withGeoPhoto}</strong> geo-linked
          </span>
        </div>
        <div className="app-survey-pas128-dashboard__legend">
          {Object.entries(stats.byQl).map(([ql, n]) => (
            <span key={ql} className="app-survey-pas128-dashboard__legend-item">
              <i style={{ background: PAS128_QL_COLORS[ql] || "#64748b" }} aria-hidden />
              {ql}: {n}
            </span>
          ))}
        </div>
        {stats.byConfidence && Object.keys(stats.byConfidence).length ? (
          <div className="app-survey-pas128-dashboard__confidence">
            {Object.entries(stats.byConfidence).map(([k, n]) => (
              <span
                key={k}
                className="app-survey-confidence-chip"
                style={{ "--conf-color": CONFIDENCE_COLORS[k] || "#64748b" }}
              >
                {confidenceLabel(k)} · {n}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(SurveyPas128Dashboard);
