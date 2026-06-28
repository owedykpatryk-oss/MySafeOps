import { ms } from "../../../utils/moduleStyles";

const ss = ms;

export default function PermitDialogShell({ title, titleId, description, children, onClose, footer, maxWidth = 520, zIndex = 60 }) {
  return (
    <div
      className="app-module-dialog-overlay"
      style={{ zIndex }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--color-background-primary,#fff)",
          borderRadius: 10,
          border: "1px solid var(--color-border-tertiary,#e5e5e5)",
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        <div id={titleId} style={{ fontWeight: 700, fontSize: 15, marginBottom: description ? 6 : 10 }}>
          {title}
        </div>
        {description ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12, lineHeight: 1.45 }}>
            {description}
          </div>
        ) : null}
        {children}
        {footer ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export { ss as permitDialogStyles };
