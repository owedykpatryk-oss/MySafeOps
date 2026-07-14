import { useMemo, useState } from "react";
import {
  cycleConflictOutcome,
  effectiveConflictOutcome,
  mergeConflictMatrix,
  normalizeConflictPair,
  PERMIT_CONFLICT_MATRIX,
} from "../permitConflictMatrix";

const OUTCOME_META = {
  allow: { label: "Allow", short: "·", bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
  warn: { label: "Warn", short: "!", bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  block: { label: "Block", short: "✕", bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
};

export default function PermitConflictMatrixGrid({
  permitTypes = {},
  overrides = {},
  onChangeOverrides,
  maxTypes = 12,
}) {
  const [focusPair, setFocusPair] = useState(null);

  const typeIds = useMemo(() => {
    const ids = Object.keys(permitTypes || {});
    return ids.slice(0, Math.max(4, maxTypes));
  }, [permitTypes, maxTypes]);

  const merged = useMemo(
    () => mergeConflictMatrix(PERMIT_CONFLICT_MATRIX, overrides),
    [overrides]
  );

  const cycleCell = (typeA, typeB) => {
    if (typeA === typeB) return;
    const eff = effectiveConflictOutcome(typeA, typeB, overrides, PERMIT_CONFLICT_MATRIX);
    const nextOutcome = cycleConflictOutcome(eff.outcome);
    const key = normalizeConflictPair(typeA, typeB);
    const base = effectiveConflictOutcome(typeA, typeB, {}, PERMIT_CONFLICT_MATRIX);
    const next = { ...overrides };
    if (nextOutcome === base.outcome || (nextOutcome === "allow" && base.outcome === "allow")) {
      delete next[key];
    } else {
      next[key] = {
        outcome: nextOutcome,
        reason: next[key]?.reason || eff.reason || base.reason || "",
      };
    }
    onChangeOverrides?.(next);
    setFocusPair(key);
  };

  const focusRule = focusPair ? merged[focusPair] : null;

  return (
    <div className="ptw-conflict-grid">
      <div className="ptw-conflict-grid__legend">
        {Object.entries(OUTCOME_META).map(([k, m]) => (
          <span key={k} className="ptw-conflict-grid__legend-item" style={{ background: m.bg, color: m.color, borderColor: m.border }}>
            {m.label}
          </span>
        ))}
        <span className="ptw-conflict-grid__legend-hint">Tap a cell to cycle allow → warn → block</span>
      </div>
      <div className="ptw-conflict-grid__scroll">
        <table className="ptw-conflict-grid__table">
          <thead>
            <tr>
              <th className="ptw-conflict-grid__corner" />
              {typeIds.map((id) => (
                <th key={`col-${id}`} className="ptw-conflict-grid__head" title={permitTypes[id]?.label || id}>
                  {(permitTypes[id]?.label || id).split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typeIds.map((rowId) => (
              <tr key={`row-${rowId}`}>
                <th className="ptw-conflict-grid__row-label" title={permitTypes[rowId]?.label || rowId}>
                  {(permitTypes[rowId]?.label || rowId).split(" ")[0]}
                </th>
                {typeIds.map((colId) => {
                  if (rowId === colId) {
                    return <td key={`${rowId}-${colId}`} className="ptw-conflict-grid__cell ptw-conflict-grid__cell--diag">—</td>;
                  }
                  const eff = effectiveConflictOutcome(rowId, colId, overrides, PERMIT_CONFLICT_MATRIX);
                  const meta = OUTCOME_META[eff.outcome] || OUTCOME_META.allow;
                  const pairKey = normalizeConflictPair(rowId, colId);
                  const isOverride = Boolean(overrides[pairKey]);
                  return (
                    <td key={`${rowId}-${colId}`} className="ptw-conflict-grid__cell-wrap">
                      <button
                        type="button"
                        className={`ptw-conflict-grid__cell${isOverride ? " ptw-conflict-grid__cell--override" : ""}${focusPair === pairKey ? " ptw-conflict-grid__cell--focus" : ""}`}
                        style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
                        title={`${permitTypes[rowId]?.label} × ${permitTypes[colId]?.label}: ${meta.label}${eff.reason ? ` — ${eff.reason}` : ""}`}
                        onClick={() => cycleCell(rowId, colId)}
                        aria-label={`${meta.label} conflict between ${rowId} and ${colId}`}
                      >
                        {meta.short}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {focusPair && focusRule ? (
        <div className="ptw-conflict-grid__detail">
          <strong>{focusPair.replace("+", " × ")}</strong>
          <span>{OUTCOME_META[focusRule.outcome]?.label || focusRule.outcome}</span>
          {focusRule.reason ? <span className="ptw-conflict-grid__detail-reason">{focusRule.reason}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
