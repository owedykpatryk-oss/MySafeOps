/** Shared lazy-route / lazy-module loading UI (kept tiny so it stays in the main chunk). */
export function ViewFallback() {
  return (
    <div
      className="app-view-fallback"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        textAlign: "center",
        color: "var(--color-text-secondary)",
        fontSize: 14,
      }}
    >
      <div className="app-route-spinner" aria-hidden />
      <span className="app-view-fallback-text">Loading…</span>
    </div>
  );
}
