/** Fixed banner shown during the final idle-logout warning minute. */
export default function IdleSessionWarningBanner({ warnSeconds, staySignedIn, timeoutMinutes }) {
  if (!warnSeconds || warnSeconds <= 0) return null;
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Session idle warning"
      style={{
        position: "fixed",
        zIndex: "var(--z-toast, 12000)",
        left: 12,
        right: 12,
        bottom: 12,
        maxWidth: 420,
        margin: "0 auto",
        padding: "14px 16px",
        borderRadius: 10,
        background: "var(--color-surface, #fff)",
        border: "1px solid var(--color-warning-border, #fcd34d)",
        boxShadow: "0 8px 28px rgba(15,23,42,0.18)",
        fontFamily: "DM Sans, system-ui, sans-serif",
        fontSize: 13,
        lineHeight: 1.45,
        color: "var(--color-text-primary, #0f172a)",
      }}
    >
      <strong style={{ display: "block", marginBottom: 6 }}>Still there?</strong>
      <p style={{ margin: "0 0 12px", color: "var(--color-text-secondary, #475569)" }}>
        You will be signed out in <strong>{warnSeconds}s</strong> after {timeoutMinutes} minutes of inactivity
        (shared site devices).
      </p>
      <button
        type="button"
        onClick={staySignedIn}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: "none",
          background: "#0d9488",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Stay signed in
      </button>
    </div>
  );
}
