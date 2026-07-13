import { memo, useState } from "react";

const DEFAULT_COLUMN_CAP = 20;

const COLUMN_EMPTY_COPY = {
  draft: { icon: "📝", text: "No drafts" },
  pending_review: { icon: "👀", text: "Nothing in review" },
  approved: { icon: "✓", text: "No approved permits" },
  active: { icon: "🟢", text: "No active permits" },
  expired: { icon: "⏱", text: "No expired permits" },
  closed: { icon: "📁", text: "No closed permits" },
};

function PermitBoard({
  columns,
  permitsByColumn,
  renderPermit,
  compact = false,
  maxPerColumn = DEFAULT_COLUMN_CAP,
}) {
  const [expandedColumns, setExpandedColumns] = useState({});

  return (
    <div
      className="app-permit-board"
      style={
        compact
          ? { display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(240px, 86vw)", gap: 10, overflowX: "auto", paddingBottom: 6 }
          : { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 10 }
      }
    >
      {columns.map((col) => {
        const colPermits = permitsByColumn[col.id] || [];
        const expanded = Boolean(expandedColumns[col.id]);
        const cap = Math.max(1, Number(maxPerColumn) || DEFAULT_COLUMN_CAP);
        const visible = expanded ? colPermits : colPermits.slice(0, cap);
        const hiddenCount = colPermits.length - visible.length;
        const emptyCopy = COLUMN_EMPTY_COPY[col.id] || { icon: "—", text: "No permits" };

        return (
          <div
            key={col.id}
            className={`app-panel-surface app-permit-board-col app-permit-board-col--${col.id}`}
          >
            <div className="app-permit-board-col__head">
              <div className="app-permit-board-col__label">
                {col.id === "active" ? <span className="app-permit-board-col__live" aria-hidden /> : null}
                {col.label}
              </div>
              <span className="app-permit-board-col__count">{colPermits.length}</span>
            </div>
            {colPermits.length === 0 ? (
              <div className="app-permit-board-col__empty">
                <span className="app-permit-board-col__empty-icon" aria-hidden>
                  {emptyCopy.icon}
                </span>
                <span>{emptyCopy.text}</span>
              </div>
            ) : (
              <>
                {visible.map((p) => renderPermit(p))}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setExpandedColumns((prev) => ({ ...prev, [col.id]: true }))}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border-tertiary,#e5e7eb)",
                      background: "var(--color-background-secondary,#f8fafc)",
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + {hiddenCount} more in {col.label}
                  </button>
                ) : null}
                {expanded && colPermits.length > cap ? (
                  <button
                    type="button"
                    onClick={() => setExpandedColumns((prev) => ({ ...prev, [col.id]: false }))}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: "6px 10px",
                      border: "none",
                      background: "transparent",
                      color: "var(--color-text-tertiary,#94a3b8)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Show fewer
                  </button>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(PermitBoard);
