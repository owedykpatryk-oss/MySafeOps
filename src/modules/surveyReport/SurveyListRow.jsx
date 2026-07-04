import { memo } from "react";
import StatusChip from "../../components/StatusChip";
import { getSurveyStatusMeta } from "../../utils/statusChipMeta";
import { ms } from "../../utils/moduleStyles";
import { surveyTypeLabel } from "./surveyReportHelpers";
import SurveyProgressRing from "./SurveyProgressRing";

const ss = ms;

function SurveyListRow({
  enriched,
  showGroupHeader,
  groupLabel,
  groupCount,
  caps,
  pdfBusy,
  bulkMode,
  selected,
  onToggleSelect,
  onEdit,
  onPdf,
  onPrint,
  onPack,
  onDuplicate,
  onHtmlExport,
  onGeoJsonExport,
  onKmlExport,
  onKmzExport,
  onGpxExport,
  onCadPackExport,
  onRevision,
  onProjectHub,
  onDelete,
}) {
  const r = enriched.report;
  const q = enriched.quality;

  return (
    <div>
      {showGroupHeader ? (
        <div className="app-survey-list-group__title">
          {groupLabel}
          <span>{groupCount}</span>
        </div>
      ) : null}
      <div
        className={`app-survey-list-row${enriched.isFinal ? " app-survey-list-row--final" : ""}${enriched.ready ? " app-survey-list-row--ready" : ""}`}
      >
        {bulkMode ? (
          <label style={{ display: "flex", alignItems: "center", paddingRight: 4 }}>
            <input type="checkbox" checked={Boolean(selected)} onChange={() => onToggleSelect?.(r.id)} aria-label={`Select ${r.title || r.ref}`} />
          </label>
        ) : null}
        <SurveyProgressRing
          value={enriched.score}
          size={48}
          stroke={4}
          className="app-survey-list-row__ring"
          animate={false}
        />
        {enriched.mapThumb ? (
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
                {enriched.ready ? (
                  <span className="app-survey-list-row__ready-pill">Ready to finalise</span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                {r.ref} · {r.surveyDate}
                {r.surveyType ? ` · ${surveyTypeLabel(r.surveyType)}` : ""}
              </div>
              <div className="app-survey-list-row__meter" aria-hidden>
                <div className="app-survey-list-row__meter-fill" style={{ width: `${q.score}%` }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
              <button type="button" style={ss.btnP} onClick={() => onEdit(r)}>
                Edit
              </button>
              <button type="button" style={ss.btn} disabled={pdfBusy} onClick={() => onPdf(r)}>
                {pdfBusy ? "PDF…" : "PDF"}
              </button>
              <button type="button" style={ss.btn} onClick={() => onPrint(r)}>
                Print
              </button>
              <button type="button" style={ss.btn} onClick={() => onPack(r)}>
                Pack
              </button>
              <button type="button" style={ss.btn} onClick={() => onDuplicate(r)}>
                Duplicate
              </button>
              <details className="app-survey-list-more">
                <summary style={ss.btn}>More</summary>
                <div className="app-survey-list-more__menu">
                  <button type="button" onClick={() => onHtmlExport(r)}>
                    HTML export
                  </button>
                  {onGeoJsonExport ? (
                    <button type="button" onClick={() => onGeoJsonExport(r)}>
                      GeoJSON
                    </button>
                  ) : null}
                  {onKmlExport ? (
                    <button type="button" onClick={() => onKmlExport(r)}>
                      KML (geo-photos)
                    </button>
                  ) : null}
                  {onKmzExport ? (
                    <button type="button" onClick={() => onKmzExport(r)}>
                      KMZ + photos
                    </button>
                  ) : null}
                  {onGpxExport ? (
                    <button type="button" onClick={() => onGpxExport(r)}>
                      GPX (geo-photos)
                    </button>
                  ) : null}
                  {onCadPackExport ? (
                    <button type="button" onClick={() => onCadPackExport(r)}>
                      CAD pack (geo-photos)
                    </button>
                  ) : null}
                  {r.status === "final" && onRevision ? (
                    <button type="button" onClick={() => onRevision(r)}>
                      New revision
                    </button>
                  ) : null}
                  {r.projectId && onProjectHub ? (
                    <button type="button" onClick={() => onProjectHub(r)}>
                      Project hub
                    </button>
                  ) : null}
                </div>
              </details>
              {caps?.deleteRecords ? (
                <button type="button" style={{ ...ss.btn, color: "#A32D2D" }} onClick={() => onDelete(r)}>
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SurveyListRow);
