import { useMemo } from "react";
import { computeFessRamsCompleteness, fessCompletenessBandStyle } from "../../utils/fessRamsCompleteness";

/**
 * FESS RAMS completeness badge for builder and client sites hub.
 */
export default function FessRamsCompletenessBadge({ form, rows, projects = [], library = [], compact = false }) {
  const project = useMemo(
    () => (projects || []).find((p) => p.id === form?.projectId) || null,
    [projects, form?.projectId]
  );
  const siteTemplateId = project?.fessSiteTemplateId || form?.fessSiteTemplateId || "";

  const result = useMemo(
    () =>
      computeFessRamsCompleteness(form, rows, {
        siteTemplateId,
        library,
      }),
    [form, rows, siteTemplateId, library]
  );

  if (!result) return null;

  const style = fessCompletenessBandStyle(result);

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: compact ? "row" : "column",
        alignItems: compact ? "center" : "flex-start",
        gap: compact ? 8 : 4,
        padding: compact ? "4px 10px" : "8px 12px",
        borderRadius: 8,
        background: style.bg,
        border: `1px solid ${style.color}22`,
      }}
      title={result.issues.join(" · ")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: style.color }}>{style.label}</span>
        <span
          style={{
            fontSize: compact ? 12 : 14,
            fontWeight: 800,
            color: style.color,
            background: "#fff",
            padding: "2px 8px",
            borderRadius: 20,
          }}
        >
          {result.score}%
        </span>
      </div>
      {!compact ? (
        <div style={{ fontSize: 10, color: style.color, lineHeight: 1.4 }}>
          {result.presentCount}/{result.expectedCount} expected hazards · {result.rowCount} rows
          {result.missing.length > 0 ? ` · ${result.missing.length} missing` : ""}
        </div>
      ) : null}
    </div>
  );
}
