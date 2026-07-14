import { bucketComplianceDueItems, formatComplianceDueLabel } from "../utils/complianceDueCalendar";

function DueRow({ item, onSelect }) {
  const tone =
    item.severity === "expired" ? "#791F1F" : item.severity === "critical" ? "#92400e" : "var(--color-text-secondary)";
  const bg =
    item.severity === "expired" ? "#FCEBEB" : item.severity === "critical" ? "#FAEEDA" : "var(--color-bg-secondary, #f8fafc)";

  return (
    <button
      type="button"
      className="compliance-due-row"
      onClick={() => onSelect?.(item)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderRadius: 8,
        padding: "8px 10px",
        fontFamily: "inherit",
        fontSize: 12,
        cursor: "pointer",
        background: bg,
        color: tone,
      }}
    >
      <strong>{item.label}</strong>
      <span style={{ opacity: 0.85 }}> · {item.subject}</span>
      <div style={{ fontSize: 11, marginTop: 2, opacity: 0.9 }}>
        {formatComplianceDueLabel(item)} · {item.dueIso}
        {item.kind === "cert" ? " · Certificate" : item.kind === "training" ? " · Training" : item.kind === "vehicle" ? " · Fleet" : " · Equipment"}
      </div>
    </button>
  );
}

function DueSection({ title, items, onSelect }) {
  if (!items.length) return null;
  return (
    <div className="compliance-due-section">
      <div className="compliance-due-section__title">{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((item) => (
          <DueRow key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/**
 * Compact 30-day compliance calendar — certs, training, LOLER/PAT/plant.
 */
export default function ComplianceDuePanel({ items = [], onSelect, maxRows = 10 }) {
  if (!items.length) return null;

  const visible = items.slice(0, maxRows);
  const buckets = bucketComplianceDueItems(visible);
  const hidden = items.length - visible.length;

  return (
    <div id="people-compliance-calendar" className="compliance-due-panel app-surface-card app-panel-surface" role="region" aria-label="Compliance due calendar">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Compliance calendar</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Certificates, training, and equipment checks due in the next 30 days.
          </div>
        </div>
        <span className="app-chip">{items.length} due</span>
      </div>
      <DueSection title="Overdue" items={buckets.overdue} onSelect={onSelect} />
      <DueSection title="Due within 7 days" items={buckets.thisWeek} onSelect={onSelect} />
      <DueSection title="Due later this month" items={buckets.later} onSelect={onSelect} />
      {hidden > 0 ? (
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8 }}>
          +{hidden} more — fix overdue items first.
        </div>
      ) : null}
    </div>
  );
}
