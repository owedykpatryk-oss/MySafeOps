import { useMemo, useState } from "react";
import { formatRouteDuration } from "../utils/hospitalRoute";
import { captureElementPngBlob, downloadPngBlob } from "../utils/captureElementPng";
import { safeHttpUrl } from "../utils/safeUrl";
import { safeImageSrc } from "../utils/htmlEscape.js";

/**
 * Smart emergency intel — nearest A&E route, screenshot preview, collapsible panel.
 */
export default function ProjectDrawingEmergencyIntel({
  project,
  siteLat,
  siteLng,
  hospitalIntel,
  hospitalBusy,
  showHospitalRoute,
  onToggleShowRoute,
  onFetchHospital,
  onSaveToProject,
  onCaptureScreenshot,
  captureBusy,
  r2Enabled,
}) {
  const [open, setOpen] = useState(true);
  const hasSite = Number.isFinite(Number(siteLat)) && Number.isFinite(Number(siteLng));
  const hospital = hospitalIntel?.hospital;
  const durationLabel = formatRouteDuration(hospitalIntel?.duration_s);
  const distanceKm =
    hospitalIntel?.hospital?.distance_km != null
      ? `${Number(hospitalIntel.hospital.distance_km).toFixed(1)} km`
      : "";
  const savedScreenshot = String(project?.hospitalRouteScreenshotUrl || "").trim();
  const savedDirections = String(project?.hospitalDirectionsUrl || "").trim();
  const savedSummary = String(project?.nearestHospital || "").trim();
  const directionsHref = safeHttpUrl(savedDirections);
  const screenshotHref = safeImageSrc(savedScreenshot) || safeHttpUrl(savedScreenshot);

  const statusTone = useMemo(() => {
    if (hospitalBusy) return "loading";
    if (hospital || savedSummary) return "ready";
    if (hasSite) return "idle";
    return "warn";
  }, [hospitalBusy, hospital, savedSummary, hasSite]);

  const copyText = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      onSaveToProject?.({ toast: `Copied ${label}` });
    } catch {
      onSaveToProject?.({ toast: `Copy ${label} manually` });
    }
  };

  return (
    <details className="pde-emergency-intel" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="pde-emergency-intel__summary">
        <div className="pde-emergency-intel__summary-main">
          <span className="pde-emergency-intel__icon" aria-hidden>🏥</span>
          <div>
            <div className="pde-emergency-intel__title">Emergency route — nearest A&amp;E</div>
            <div className="pde-emergency-intel__sub">
              Driving route, Google Maps link and PNG for RAMS / permits
            </div>
          </div>
        </div>
        <span className={`pde-emergency-intel__badge pde-emergency-intel__badge--${statusTone}`}>
          {hospitalBusy ? "Looking up…" : hospital || savedSummary ? "Ready" : hasSite ? "Tap to set up" : "Need site"}
        </span>
      </summary>

      <div className="pde-emergency-intel__body">
        <div className="pde-emergency-intel__grid">
          <div className="pde-emergency-intel__main">
            {(hospital?.summary || savedSummary) ? (
              <div className="pde-emergency-intel__hospital">
                <div className="pde-emergency-intel__hospital-name">{hospital?.summary || savedSummary}</div>
                <div className="pde-emergency-intel__meta">
                  {[distanceKm, durationLabel].filter(Boolean).join(" · ")}
                </div>
              </div>
            ) : (
              <div className="pde-emergency-intel__empty">
                {hasSite
                  ? "One click loads the nearest hospital, draws the route on your map, and prepares a screenshot attachment."
                  : "Centre the map on your project postcode first."}
              </div>
            )}

            <div className="pde-emergency-intel__actions">
              <button type="button" className="pde-emergency-intel__btn pde-emergency-intel__btn--primary" disabled={!hasSite || hospitalBusy} onClick={onFetchHospital}>
                {hospitalBusy ? "Fetching…" : hospital ? "Refresh route" : "Find nearest A&E"}
              </button>
              <button type="button" className="pde-emergency-intel__btn" disabled={!hospitalIntel?.ring?.length || captureBusy} onClick={onCaptureScreenshot}>
                {captureBusy ? "Capturing…" : "Save PNG + link"}
              </button>
              <label className="pde-emergency-intel__toggle">
                <input type="checkbox" checked={showHospitalRoute} disabled={!hospitalIntel?.ring?.length} onChange={(e) => onToggleShowRoute(e.target.checked)} />
                Show on map
              </label>
            </div>

            {(directionsHref || screenshotHref) ? (
              <div className="pde-emergency-intel__saved">
                {directionsHref ? (
                  <div className="pde-emergency-intel__link-row">
                    <a href={directionsHref} target="_blank" rel="noopener noreferrer" className="pde-emergency-intel__link">
                      Open directions in Google Maps
                    </a>
                    <button type="button" className="pde-emergency-intel__link-btn" onClick={() => copyText(directionsHref, "directions link")}>
                      Copy link
                    </button>
                  </div>
                ) : null}
                {screenshotHref ? (
                  <div className="pde-emergency-intel__link-row">
                    <a href={screenshotHref} target="_blank" rel="noopener noreferrer" className="pde-emergency-intel__link">
                      Open saved screenshot
                    </a>
                  </div>
                ) : null}
                {!r2Enabled ? (
                  <div className="pde-emergency-intel__hint">PNG also downloads locally. Cloud storage adds a shareable project link.</div>
                ) : null}
              </div>
            ) : null}
          </div>

          {screenshotHref ? (
            <a href={screenshotHref} target="_blank" rel="noopener noreferrer" className="pde-emergency-intel__preview" aria-label="Open route screenshot">
              <img src={screenshotHref} alt="Saved hospital route map" loading="lazy" />
              <span className="pde-emergency-intel__preview-label">Saved attachment</span>
            </a>
          ) : (
            <div className="pde-emergency-intel__preview pde-emergency-intel__preview--empty">
              <span>Screenshot preview</span>
              <small>Save PNG + link to attach to RAMS</small>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

export async function captureHospitalRoutePng(mapElementId = "pde-map-capture-root") {
  const el = document.getElementById(mapElementId);
  return captureElementPngBlob(el, { scale: 2, backgroundColor: "#f1f5f9" });
}

export function downloadHospitalRoutePng(blob, projectId) {
  downloadPngBlob(blob, `hospital-route-${projectId || "site"}.png`);
}
