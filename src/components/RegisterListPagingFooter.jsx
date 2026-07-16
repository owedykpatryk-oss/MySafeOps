/**
 * Shared “Show more” footer for register / list paging (aria-live for a11y).
 */
export default function RegisterListPagingFooter({
  hasMore,
  remaining,
  showing,
  total,
  onShowMore,
  itemLabel = "records",
  buttonStyle,
}) {
  if (!hasMore) return null;
  const btn = buttonStyle || {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid var(--color-border-tertiary,#e5e5e5)",
    background: "var(--color-background-primary,#fff)",
    cursor: "pointer",
    fontSize: 13,
  };
  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div
        role="status"
        aria-live="polite"
        style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}
      >
        Showing {showing} of {total} {itemLabel}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button type="button" onClick={onShowMore} style={btn}>
          Show more ({remaining} remaining)
        </button>
      </div>
    </div>
  );
}
