import { ms } from "../utils/moduleStyles";

/**
 * Shared empty / no-results panel for register modules.
 */
export default function RegisterEmptyState({
  icon = "📋",
  title,
  lead,
  primaryAction,
  primaryLabel,
  secondaryAction,
  secondaryLabel = "Clear filters",
}) {
  return (
    <div className="register-empty-state">
      <div className="register-empty-state__icon" aria-hidden>
        {icon}
      </div>
      <h3 className="register-empty-state__title">{title}</h3>
      {lead ? <p className="register-empty-state__lead">{lead}</p> : null}
      <div className="register-empty-state__actions">
        {primaryAction && primaryLabel ? (
          <button type="button" style={ms.btnP} onClick={primaryAction}>
            {primaryLabel}
          </button>
        ) : null}
        {secondaryAction ? (
          <button type="button" style={ms.btn} onClick={secondaryAction}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
