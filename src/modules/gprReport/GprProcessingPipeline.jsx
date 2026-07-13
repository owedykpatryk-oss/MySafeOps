import { memo } from "react";
import { PROCESSING_FILTER_CATALOG } from "./gprReportConstants";

function GprProcessingPipeline({ filters, software }) {
  const rows = filters?.length
    ? filters
    : PROCESSING_FILTER_CATALOG.map((f) => ({
        key: f.key,
        label: f.label,
        applied: f.defaultApplied,
      }));

  const active = rows.filter((f) => f.applied);
  const pct = rows.length ? Math.round((active.length / rows.length) * 100) : 0;

  return (
    <div className="app-gpr-pipeline">
      <div className="app-gpr-pipeline__head">
        <strong>Processing pipeline</strong>
        {software ? <span className="app-gpr-pipeline__sw">{software}</span> : null}
        <span className="app-gpr-pipeline__pct">{active.length}/{rows.length} filters · {pct}%</span>
      </div>
      <div className="app-gpr-pipeline__track">
        <div className="app-gpr-pipeline__fill" style={{ width: `${pct}%` }} />
        {rows.map((f, i) => (
          <div
            key={f.key || i}
            className={`app-gpr-pipeline__node${f.applied ? " app-gpr-pipeline__node--on" : ""}`}
            title={f.label}
          >
            <span className="app-gpr-pipeline__dot" />
            <span className="app-gpr-pipeline__label">{f.label.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(GprProcessingPipeline);
