import { ms } from "../utils/moduleStyles";

const ss = ms;

/**
 * Shared confirmation modal — replaces blocking window.confirm for key flows.
 */
export default function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
  zIndex = 70,
}) {
  if (!open) return null;

  const confirmStyle =
    tone === "danger"
      ? { ...ss.btn, borderColor: "#fecaca", color: "#b91c1c", fontWeight: 600 }
      : { ...ss.btnO, fontWeight: 600 };

  return (
    <div
      className="app-module-dialog-overlay"
      style={{ zIndex }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--color-background-primary,#fff)",
          borderRadius: 10,
          border: "1px solid var(--color-border-tertiary,#e5e5e5)",
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        <div id="confirm-dialog-title" style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          {title}
        </div>
        {message ? (
          <div
            id="confirm-dialog-desc"
            style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 16 }}
          >
            {message}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={ss.btn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" style={confirmStyle} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
