/**
 * Manage project escape routes — rename, delete, zoom on map.
 */
export default function ProjectDrawingEscapeRoutesPanel({
  routes = [],
  highlightId = "",
  appendMode = false,
  selectedPointIndex = -1,
  disabled = false,
  onRename,
  onDelete,
  onZoom,
  onHighlight,
  onToggleAppend,
  onRemovePoint,
  onDuplicate,
}) {
  if (!routes.length) {
    return (
      <div className="pde-escape-routes pde-escape-routes--empty">
        <div className="pde-escape-routes__title">Escape routes</div>
        <div className="pde-escape-routes__hint">Use the Escape route tool — click 2+ waypoints, then Finish route.</div>
      </div>
    );
  }

  const activeRoute = routes.find((r) => r.id === highlightId);
  const activePointCount = (activeRoute?.points || []).length;

  return (
    <div className="pde-escape-routes" role="region" aria-label="Escape routes">
      <div className="pde-escape-routes__head">
        <div className="pde-escape-routes__title">Escape routes ({routes.length})</div>
        {highlightId ? (
          <span className="pde-escape-routes__edit-hint">
            {appendMode ? "Click map to add point · Esc to cancel" : "Select — drag handles · click line to insert · Del removes point"}
          </span>
        ) : null}
      </div>
      {highlightId ? (
        <div className="pde-escape-routes__tools">
          <button
            type="button"
            className={`pde-escape-routes__btn${appendMode ? " pde-escape-routes__btn--active" : ""}`}
            disabled={disabled}
            onClick={() => onToggleAppend?.(highlightId)}
          >
            {appendMode ? "Adding point…" : "Add point"}
          </button>
          <button
            type="button"
            className="pde-escape-routes__btn"
            disabled={disabled || activePointCount <= 2 || selectedPointIndex < 0}
            onClick={() => onRemovePoint?.(highlightId, selectedPointIndex >= 0 ? selectedPointIndex : activePointCount - 1)}
          >
            Remove point
          </button>
          <button type="button" className="pde-escape-routes__btn" disabled={disabled} onClick={() => onDuplicate?.(highlightId)}>
            Duplicate
          </button>
        </div>
      ) : null}
      <ul className="pde-escape-routes__list">
        {routes.map((route) => {
          const active = highlightId === route.id;
          const pointCount = (route.points || []).length;
          return (
            <li key={route.id} className={`pde-escape-routes__item${active ? " pde-escape-routes__item--active" : ""}`}>
              <input
                type="text"
                className="pde-escape-routes__name"
                value={route.name || ""}
                disabled={disabled}
                onChange={(e) => onRename?.(route.id, e.target.value)}
                onFocus={() => onHighlight?.(route.id)}
                aria-label="Route name"
              />
              <span className="pde-escape-routes__meta">{pointCount} pts</span>
              <button
                type="button"
                className="pde-escape-routes__btn"
                disabled={disabled || pointCount < 2}
                onClick={() => onZoom?.(route)}
                title="Zoom map to this route"
              >
                Edit
              </button>
              <button
                type="button"
                className="pde-escape-routes__btn pde-escape-routes__btn--danger"
                disabled={disabled}
                onClick={() => onDelete?.(route.id)}
                title="Delete route"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
