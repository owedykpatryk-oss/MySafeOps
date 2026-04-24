import { requestD1OutboxManualRetry } from "../lib/d1OutboxRetryEvent.js";

/**
 * Cloud D1 sync status strip: hydration vs IndexedDB upload queue (useD1OrgArraySync).
 *
 * @param {object} p
 * @param {boolean} p.d1Hydrating – initial GET / seed in progress (D1 configured)
 * @param {boolean} p.d1OutboxPending – failed PUTs queued for retry
 * @param {string} [p.scopeLabel] – phrase used in default messages (e.g. "COSHH register")
 * @param {string} [p.hydrateMessage] – overrides default "Syncing {scopeLabel} with cloud…"
 * @param {string} [p.queueMessage] – overrides default queue copy
 * @param {boolean} [p.showManualRetry=true] – show "Retry now" when only outbox pending (not hydrating)
 * @param {string} [p.manualRetryLabel="Retry now"]
 */
export function D1ModuleSyncBanner({
  d1Hydrating,
  d1OutboxPending,
  scopeLabel,
  hydrateMessage,
  queueMessage,
  showManualRetry = true,
  manualRetryLabel = "Retry now",
}) {
  if (!d1Hydrating && !d1OutboxPending) return null;
  const h =
    hydrateMessage ??
    (scopeLabel ? `Syncing ${scopeLabel} with cloud…` : "Syncing with cloud…");
  const q =
    queueMessage ??
    (scopeLabel
      ? `${scopeLabel}: upload queued — will retry when you're online.`
      : "Upload queued — will retry when you're online.");
  const text = d1Hydrating ? h : q;
  const showRetry = showManualRetry && !d1Hydrating && d1OutboxPending;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={d1Hydrating}
      className="app-panel-surface"
      style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>{text}</span>
        {showRetry ? (
          <button
            type="button"
            onClick={() => requestD1OutboxManualRetry()}
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 6,
              border: "0.5px solid var(--color-border-secondary,#ccc)",
              background: "var(--color-background-primary,#fff)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {manualRetryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
