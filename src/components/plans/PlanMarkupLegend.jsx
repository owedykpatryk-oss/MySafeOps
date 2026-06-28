import { buildPlanLegend } from "../../utils/planMarkupMeta";

function Swatch({ swatch }) {
  if (swatch.kind === "route") {
    return (
      <span className="plan-legend-swatch plan-legend-swatch--route" aria-hidden>
        <span style={{ borderColor: swatch.color }} />
      </span>
    );
  }
  if (swatch.kind === "zone") {
    return (
      <span
        className="plan-legend-swatch plan-legend-swatch--zone"
        aria-hidden
        style={{ background: swatch.fill || swatch.color, borderColor: swatch.color }}
      />
    );
  }
  return (
    <span className="plan-legend-swatch plan-legend-swatch--asset" aria-hidden style={{ background: swatch.color }}>
      {swatch.short || "•"}
    </span>
  );
}

/** Automatic legend — only shows types present on the plan. */
export default function PlanMarkupLegend({ plan, compact = false }) {
  const { swatches, rows, counts } = buildPlanLegend(plan);
  const total = counts.routes + counts.zones + counts.assets;

  if (!total) {
    return (
      <div className={`plan-markup-legend plan-markup-legend--empty${compact ? " plan-markup-legend--compact" : ""}`}>
        <div className="plan-markup-legend__title">Legend</div>
        <p>Mark routes, zones or assets — the legend fills in automatically.</p>
      </div>
    );
  }

  return (
    <div className={`plan-markup-legend${compact ? " plan-markup-legend--compact" : ""}`} aria-label="Plan legend">
      <div className="plan-markup-legend__head">
        <span className="plan-markup-legend__title">Legend</span>
        <span className="plan-markup-legend__counts">
          {counts.routes ? `${counts.routes} route${counts.routes === 1 ? "" : "s"}` : null}
          {counts.routes && counts.zones ? " · " : null}
          {counts.zones ? `${counts.zones} zone${counts.zones === 1 ? "" : "s"}` : null}
          {(counts.routes || counts.zones) && counts.assets ? " · " : null}
          {counts.assets ? `${counts.assets} asset${counts.assets === 1 ? "" : "s"}` : null}
        </span>
      </div>
      {swatches.length ? (
        <div className="plan-markup-legend__swatches">
          {swatches.map((s) => (
            <div key={`${s.kind}-${s.label}`} className="plan-markup-legend__chip">
              <Swatch swatch={s} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {!compact && rows.length ? (
        <ul className="plan-markup-legend__list">
          {rows.slice(0, 8).map((row) => (
            <li key={row.key}>
              <Swatch swatch={row.swatch} />
              <span className="plan-markup-legend__item-label">{row.label}</span>
              {row.detail && row.detail !== row.label ? (
                <span className="plan-markup-legend__item-detail">{row.detail}</span>
              ) : null}
            </li>
          ))}
          {rows.length > 8 ? <li className="plan-markup-legend__more">+{rows.length - 8} more on plan</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
