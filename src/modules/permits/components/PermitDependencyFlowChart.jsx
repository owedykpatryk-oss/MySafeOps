export default function PermitDependencyFlowChart({
  permitTypeKey = "",
  permitTypeLabel = "",
  rules = [],
  permitTypes = {},
}) {
  if (!permitTypeKey) return null;

  return (
    <div className="ptw-dep-flow" aria-label="Permit dependency flow">
      <div className="ptw-dep-flow__source">
        <span className="ptw-dep-flow__badge">Permit type</span>
        <strong>{permitTypeLabel || permitTypeKey}</strong>
      </div>

      {rules.length === 0 ? (
        <p className="ptw-dep-flow__empty">No active dependencies — this type can be issued without other permits.</p>
      ) : (
        <ul className="ptw-dep-flow__list">
          {rules.map((row, idx) => {
            const reqKey = row.requiresActiveType || "";
            const reqLabel = permitTypes[reqKey]?.label || reqKey || "Unknown type";
            return (
              <li key={`dep-flow-${permitTypeKey}-${idx}`} className="ptw-dep-flow__item">
                <span className="ptw-dep-flow__arrow" aria-hidden="true">
                  requires active
                </span>
                <div className="ptw-dep-flow__target">
                  <strong>{reqLabel}</strong>
                  {row.reason ? <span className="ptw-dep-flow__reason">{row.reason}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
