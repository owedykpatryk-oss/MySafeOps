import { memo } from "react";
import StatusChip from "../../components/StatusChip";
import { getSurveyStatusMeta } from "../../utils/statusChipMeta";
import SurveyProgressRing from "../surveyReport/SurveyProgressRing";

function GprListRow({ enriched, onEdit, onDelete }) {
  const r = enriched.report;

  return (
    <div
      className={`app-survey-list-row app-gpr-list-row${enriched.isFinal ? " app-survey-list-row--final" : ""}${enriched.ready ? " app-survey-list-row--ready" : ""}`}
      onClick={onEdit}
      onKeyDown={(e) => e.key === "Enter" && onEdit?.()}
      role="button"
      tabIndex={0}
    >
      <SurveyProgressRing value={enriched.score} size={48} stroke={4} className="app-survey-list-row__ring" animate={false} />
      {enriched.radargramThumb ? (
        <div className="app-gpr-list-row__radar">
          <img src={enriched.radargramThumb} alt="" loading="lazy" decoding="async" />
        </div>
      ) : enriched.mapThumb ? (
        <div className="app-survey-list-row__map">
          <img src={enriched.mapThumb} alt="" loading="lazy" decoding="async" />
        </div>
      ) : null}
      <div className="app-survey-list-row__body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 15 }}>{r.title || r.ref || "Untitled"}</strong>
              <StatusChip meta={getSurveyStatusMeta(r.status)} />
              {enriched.ready ? <span className="app-survey-list-row__ready-pill">Ready to finalise</span> : null}
              {enriched.freqLabel ? <span className="app-gpr-list-chip">{enriched.freqLabel}</span> : null}
              {enriched.penLabel ? <span className="app-gpr-list-chip app-gpr-list-chip--muted">{enriched.penLabel}</span> : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
              {r.ref} · {r.surveyDate ? new Date(r.surveyDate).toLocaleDateString("en-GB") : "—"}
              {r.siteAddress || r.projectName ? ` · ${r.siteAddress || r.projectName}` : ""}
            </div>
            <div className="app-survey-list-row__meter" aria-hidden>
              <div className="app-survey-list-row__meter-fill" style={{ width: `${enriched.score}%` }} />
            </div>
            {enriched.evidenceLabel ? (
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>{enriched.evidenceLabel}</div>
            ) : null}
            {enriched.anomalyCount ? (
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                {enriched.anomalyCount} anomal{enriched.anomalyCount === 1 ? "y" : "ies"}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="app-gpr-list-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(GprListRow);
