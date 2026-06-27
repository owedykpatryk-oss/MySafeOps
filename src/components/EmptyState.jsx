/**
 * Illustrated empty state with primary CTA — use instead of bare text blocks.
 */
export default function EmptyState({
  icon = "📋",
  title = "Nothing here yet",
  description = "",
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  variant = "default",
  compact = false,
}) {
  return (
    <div
      className={`app-empty-state${variant === "dashed" ? " app-empty-state--dashed" : ""}${compact ? " app-empty-state--compact" : ""}`}
      role="status"
    >
      <div className="app-empty-state__icon" aria-hidden>
        {icon}
      </div>
      <div className="app-empty-state__title">{title}</div>
      {description ? <p className="app-empty-state__desc">{description}</p> : null}
      {(actionLabel || secondaryLabel) && (
        <div className="app-empty-state__actions">
          {actionLabel ? (
            <button type="button" className="app-empty-state__btn app-empty-state__btn--primary" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {secondaryLabel ? (
            <button type="button" className="app-empty-state__btn" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
