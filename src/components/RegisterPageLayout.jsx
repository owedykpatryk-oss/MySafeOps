import PageHero from "./PageHero";
import RegisterModuleShell from "./RegisterModuleShell";
import RegisterEmptyState from "./RegisterEmptyState";
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
  exportRows = null,
  exportFilterNote = null,
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
      <RegisterModuleShell
        moduleId={moduleId}
        smartContext={ctx}
        stats={computedStats}
        filters={filters}
        pdfExportRows={exportRows}
        pdfExportNote={exportFilterNote}
      >
        {!list.length && emptyMessage ? (
          <RegisterEmptyState
            title={emptyMessage}
            primaryAction={onEmptyAction}
            primaryLabel={emptyActionLabel}
          />
        ) : (
          children
        )}
      </RegisterModuleShell>
    </>
  );
}
