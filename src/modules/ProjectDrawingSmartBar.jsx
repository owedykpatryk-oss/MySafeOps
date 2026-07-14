import { drawingObjectTypeMeta } from "./permits/projectDrawingRegistry";

/** One-click object types for UK site drawings. */
export const PDE_QUICK_PLACE_PRESETS = [
  { type: "master_point", label: "Muster" },
  { type: "fire_extinguisher", label: "Extinguisher" },
  { type: "fire_exit", label: "Fire exit" },
  { type: "first_aid", label: "First aid" },
  { type: "parking", label: "Parking" },
  { type: "loading_bay", label: "Loading" },
];

/**
 * Compact smart status strip — site readiness, counts, emergency intel at a glance.
 */
export default function ProjectDrawingSmartBar({
  project,
  workSurface,
  siteGeoStatus,
  hasBoundary,
  mapPointCount = 0,
  planPointCount = 0,
  areaCount = 0,
  escapeRouteCount = 0,
  hospitalReady = false,
  screenshotSaved = false,
  readiness = null,
  onCentreSite,
  onFetchHospital,
  onSwitchMap,
  onExportSitePack,
  onReadinessFix,
  sitePackBusy = false,
  hospitalBusy = false,
}) {
  const postcode = String(project?.postcode || "").trim();
  const siteOk = siteGeoStatus?.source && siteGeoStatus.source !== "default";
  const score = readiness?.score ?? 0;
  const max = readiness?.max ?? 100;
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const tone = readiness?.tone || "low";
  const missingItems = (readiness?.items || []).filter((item) => !item.done);

  return (
    <div className="pde-smart-bar" role="region" aria-label="Drawing editor status">
      <div className="pde-smart-bar__readiness" title={readiness?.missing?.length ? `Missing: ${readiness.missing.join(", ")}` : "Site pack complete"}>
        <div className={`pde-smart-bar__ring pde-smart-bar__ring--${tone}`} aria-hidden>
          <svg viewBox="0 0 36 36" className="pde-smart-bar__ring-svg">
            <path
              className="pde-smart-bar__ring-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="pde-smart-bar__ring-fill"
              strokeDasharray={`${pct}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="pde-smart-bar__ring-label">{pct}%</span>
        </div>
        <div>
          <div className="pde-smart-bar__readiness-title">{readiness?.label || "Site readiness"}</div>
          <div className="pde-smart-bar__sub">
            {missingItems.length > 0 ? (
              <div className="pde-smart-bar__fixes">
                {missingItems.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="pde-smart-bar__fix"
                    onClick={() => onReadinessFix?.(item.id)}
                    title={`Add: ${item.label}`}
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="pde-smart-bar__readiness-sub">All checks complete</span>
            )}
          </div>
        </div>
      </div>

      <div className="pde-smart-bar__chips">
        <span className={`pde-smart-chip${siteOk ? " pde-smart-chip--ok" : " pde-smart-chip--warn"}`}>
          <span className="pde-smart-chip__dot" aria-hidden />
          {siteOk ? (postcode || "Site located") : "Site not centred"}
        </span>
        <span className={`pde-smart-chip${hasBoundary ? " pde-smart-chip--ok" : ""}`}>
          {hasBoundary ? "Boundary set" : "No boundary"}
        </span>
        <span className="pde-smart-chip">
          {workSurface === "map" ? `${mapPointCount} map pts` : `${planPointCount} plan pts`}
          {areaCount > 0 ? ` · ${areaCount} areas` : ""}
          {escapeRouteCount > 0 ? ` · ${escapeRouteCount} routes` : ""}
        </span>
        <span className={`pde-smart-chip${hospitalReady ? " pde-smart-chip--ok" : " pde-smart-chip--ae"}`}>
          {hospitalReady ? "A&E route ready" : "A&E not loaded"}
          {screenshotSaved ? " · PNG saved" : ""}
        </span>
      </div>
      <div className="pde-smart-bar__actions">
        <button
          type="button"
          className="pde-smart-bar__btn pde-smart-bar__btn--accent"
          disabled={sitePackBusy}
          onClick={onExportSitePack}
          title="Download KML, manifest JSON and map PNG for RAMS / permits"
        >
          {sitePackBusy ? "Building pack…" : "Site pack"}
        </button>
        {!siteOk ? (
          <button type="button" className="pde-smart-bar__btn" onClick={onCentreSite}>
            Centre on site
          </button>
        ) : null}
        {workSurface !== "map" ? (
          <button type="button" className="pde-smart-bar__btn" onClick={onSwitchMap}>
            Open map workspace
          </button>
        ) : null}
        {!hospitalReady ? (
          <button type="button" className="pde-smart-bar__btn" disabled={hospitalBusy} onClick={onFetchHospital}>
            {hospitalBusy ? "Finding A&E…" : "Find nearest A&E"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ProjectDrawingQuickChips({ disabled, activeType, onPick }) {
  return (
    <div className="pde-quick-chips" role="group" aria-label="Quick place presets">
      <span className="pde-quick-chips__label">Quick place</span>
      {PDE_QUICK_PLACE_PRESETS.map((preset) => {
        const meta = drawingObjectTypeMeta(preset.type);
        const active = activeType === preset.type;
        return (
          <button
            key={preset.type}
            type="button"
            className={`pde-quick-chip${active ? " pde-quick-chip--active" : ""}`}
            disabled={disabled}
            onClick={() => onPick(preset.type)}
            title={`Set type to ${meta.label} — then click map or plan`}
          >
            <span className="pde-quick-chip__swatch" style={{ background: meta.color }} aria-hidden />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
