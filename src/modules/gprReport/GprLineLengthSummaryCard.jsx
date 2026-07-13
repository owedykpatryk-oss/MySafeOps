import { buildGprLineLengthSummary, buildGprSurveyLineComparison } from "./gprLineLengthSummary.js";
import { formatLengthM } from "../../utils/surveyDxfAnalyzer.js";

/**
 * Live PAS128 line-length summary for GPR chainage (editor preview).
 */
export default function GprLineLengthSummaryCard({ report, linkedSurveyReport }) {
  const visual = buildGprLineLengthSummary(report);
  if (!visual.totalM) {
    return (
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-secondary)",
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--color-bg-secondary, #f8fafc)",
          marginBottom: 12,
        }}
      >
        Name each chainage line like a CAD layer — e.g. <strong>UMG_LV_B1</strong> — and enter chainage from/to in metres.
        Totals by utility and QL appear here and in the PDF export.
      </div>
    );
  }

  const cmp = buildGprSurveyLineComparison(visual, linkedSurveyReport);

  return (
    <div
      style={{
        border: "1px solid var(--color-border-tertiary, #e5e7eb)",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: "linear-gradient(165deg, #f8fafc 0%, #fff 70%)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>PAS128 corridor lengths</div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
        {formatLengthM(visual.totalM)} classified from {visual.segmentCount} segment(s)
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.55 }}>
        {visual.summary.slice(0, 8).map((r) => (
          <li key={`${r.utilityKey}-${r.qlKey}-${r.lineRefs?.[0]}`}>
            <strong>{formatLengthM(r.lengthM)}</strong> {r.utilityLabel} · QL {r.qlKey}
          </li>
        ))}
      </ul>
      {cmp.narrative ? (
        <p style={{ fontSize: 11, color: "#0f766e", marginTop: 10, marginBottom: 0, lineHeight: 1.45 }}>
          {cmp.narrative}
        </p>
      ) : null}
    </div>
  );
}
