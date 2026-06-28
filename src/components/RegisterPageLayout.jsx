import PageHero from "./PageHero";
import RegisterModuleShell from "./RegisterModuleShell";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";

/**
 * Standard layout for HSE / site register modules — hero, stats, smart tips, filters, body.
 */
export default function RegisterPageLayout({
  moduleId,
  badgeText,
  title,
  lead,
  items,
  itemProp = "items",
  smartContext,
  stats,
  filters,
  right,
  exportModuleLabel,
  before,
  children,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
}) {
  const list = items ?? [];
  const computedStats = stats ?? buildRegisterModuleStats(moduleId, list);
  const ctx = smartContext ?? { [itemProp]: list, items: list, count: list.length };

  return (
    <>
      {before}
      <PageHero
        badgeText={badgeText}
        title={title}
        lead={lead}
        exportModuleId={moduleId}
        exportModuleLabel={exportModuleLabel || (typeof title === "string" ? title : undefined)}
        right={right}
      />
      <RegisterModuleShell moduleId={moduleId} smartContext={ctx} stats={computedStats} filters={filters}>
        {!list.length && emptyMessage ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              border: "0.5px dashed var(--color-border-tertiary,#e5e5e5)",
              borderRadius: 12,
            }}
          >
            <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 12 }}>{emptyMessage}</p>
            {emptyActionLabel && onEmptyAction ? (
              <button type="button" onClick={onEmptyAction} style={{ padding: "10px 14px", borderRadius: 6, border: "0.5px solid #085041", background: "#0d9488", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", minHeight: 44 }}>
                {emptyActionLabel}
              </button>
            ) : null}
          </div>
        ) : (
          children
        )}
      </RegisterModuleShell>
    </>
  );
}
