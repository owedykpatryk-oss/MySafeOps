import { STATUS_TONE_STYLES } from "../utils/statusChipMeta";

/**
 * Consistent status pill — Draft / Final / Active etc.
 * Pass `meta` from statusChipMeta helpers, or `tone` + `label` directly.
 */
export default function StatusChip({ meta, tone, label, icon, size = "sm", className = "" }) {
  const resolvedTone = meta?.tone || tone || "neutral";
  const resolvedLabel = meta?.label || label || "—";
  const resolvedIcon = meta?.icon ?? icon;
  const styles = STATUS_TONE_STYLES[resolvedTone] || STATUS_TONE_STYLES.neutral;
  const fontSize = size === "md" ? 12 : 11;
  const pad = size === "md" ? "3px 10px" : "2px 8px";

  return (
    <span
      className={`app-status-chip app-status-chip--${resolvedTone} ${className}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: pad,
        borderRadius: 999,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {resolvedIcon ? (
        <span aria-hidden style={{ fontSize: size === "md" ? 11 : 10 }}>
          {resolvedIcon}
        </span>
      ) : null}
      {resolvedLabel}
    </span>
  );
}
