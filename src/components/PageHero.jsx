import { ms } from "../utils/moduleStyles";
import RegisterPdfExportButton from "./RegisterPdfExportButton";
import { useRegisterPdfViewId } from "../context/RegisterPdfExportContext";
import { canExportModulePdf } from "../navigation/moduleCatalogMeta";
import { useOrgBranding } from "../hooks/useOrgBranding";

/**
 * Consistent page header (badge, title, lead, optional actions) used across workspace modules.
 * When `exportModuleId` is omitted, auto-offers PDF export if the active workspace view is a register.
 */
export default function PageHero({ badgeText, title, lead, right, marginBottom = 24, exportModuleId, exportModuleLabel }) {
  const branding = useOrgBranding();
  const len = badgeText ? String(badgeText).length : 0;
  const badgeFontSize = len > 4 ? 9 : len > 3 ? 10 : 12;
  const activeViewId = useRegisterPdfViewId();
  const pdfModuleId = exportModuleId || (canExportModulePdf(activeViewId) ? activeViewId : null);
  const pdfLabel = exportModuleLabel || (typeof title === "string" ? title : undefined);

  const hasRight = Boolean(pdfModuleId || right);
  const rightSlot = (
    <>
      {pdfModuleId ? <RegisterPdfExportButton moduleId={pdfModuleId} label={pdfLabel} /> : null}
      {right}
    </>
  );

  return (
    <div className="app-panel-surface app-page-hero" style={{ marginBottom }}>
      {badgeText ? (
        <div
          className="app-page-hero__badge"
          style={
            branding.logo
              ? undefined
              : {
                  background: branding.badgeGradient,
                  boxShadow: branding.badgeShadow,
                }
          }
          aria-hidden
        >
          {branding.logo ? (
            <img src={branding.logo} alt="" className="app-page-hero__badge-logo" />
          ) : (
            <span style={{ fontSize: badgeFontSize, fontWeight: 700, letterSpacing: "0.03em", lineHeight: 1.1 }}>{badgeText}</span>
          )}
        </div>
      ) : null}
      <div className="app-page-hero__body">
        <h2 style={ms.pageTitle}>{title}</h2>
        {lead != null && lead !== "" ? (
          typeof lead === "string" ? (
            <p style={ms.pageLead}>{lead}</p>
          ) : (
            <div style={ms.pageLead}>{lead}</div>
          )
        ) : null}
      </div>
      {hasRight ? <div className="app-page-hero__actions">{rightSlot}</div> : null}
    </div>
  );
}
