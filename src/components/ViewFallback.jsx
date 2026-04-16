/** Shared lazy-route / lazy-module loading UI (kept tiny so it stays in the main chunk). */
export function ViewFallback() {
  return (
    <div
      className="app-view-fallback"
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        textAlign: "center",
        color: "var(--color-text-secondary)",
        fontSize: 14,
      }}
    >
      <div className="app-route-spinner" aria-hidden />
      Loading…
    </div>
  );
}
