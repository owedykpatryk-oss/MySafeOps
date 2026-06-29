import { openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { getRegisterSmartTips } from "../utils/registerModuleSmart";
import { useRegisterPdfExportOverride } from "../context/RegisterPdfExportContext";

/**
 * Shared layout for More register modules — stats, smart tips, filters, content.
 */
export default function RegisterModuleShell({
  moduleId,
  smartContext = {},
  stats = [],
  filters = null,
  pdfExportRows = null,
  pdfExportNote = null,
  children,
}) {
  useRegisterPdfExportOverride(moduleId, pdfExportRows, pdfExportNote);
  const tips = moduleId ? getRegisterSmartTips(moduleId, smartContext) : [];

  const runTip = (tip) => {
    if (!tip.viewId) return;
    const target = { viewId: tip.viewId };
    if (tip.action) target.action = tip.action;
    setWorkspaceNavTarget(target);
    openWorkspaceView({ viewId: tip.viewId });
  };

  return (
    <div className="app-register-module app-register-module--glow">
      {stats.length > 0 ? (
        <div className="app-register-stats" role="list" aria-label="Register summary">
          {stats.map((s) => (
            <div key={s.label} className={`app-register-stats__card app-register-stats__card--${s.tone || "neutral"}`} role="listitem">
              <span className="app-register-stats__val">{s.value}</span>
              <span className="app-register-stats__lbl">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tips.length > 0 ? (
        <div className="app-register-smart" aria-label="Smart suggestions">
          {tips.map((tip) => (
            <div key={tip.id} className={`app-register-smart__tip app-register-smart__tip--${tip.tone || "info"}`}>
              <p className="app-register-smart__text">{tip.text}</p>
              {tip.actionLabel && tip.viewId ? (
                <button type="button" className="app-register-smart__action" onClick={() => runTip(tip)}>
                  {tip.actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {filters ? <div className="app-register-filters">{filters}</div> : null}

      <div className="app-register-module__body">{children}</div>
    </div>
  );
}
