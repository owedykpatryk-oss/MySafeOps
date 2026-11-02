import { useEffect, useRef, useState } from "react";
import DroneMap from "./DroneMap.jsx";
import { geometrySummary } from "./droneGeometry.js";
import { MAP_DESTINATIONS, MAP_POINTS, prepareMapImport } from "./mapTools.js";

export default function BoundaryImportDialog({ review, mission, busy, onClose, onConfirm }) {
  const ref = useRef(null);
  const [target, setTarget] = useState("boundary");
  const [selected, setSelected] = useState(() => review.geometry.features.map((_, i) => i));
  const [replace, setReplace] = useState(false);
  useEffect(() => {
    const dialog = ref.current,
      opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector("h2")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const geometry = { type: "FeatureCollection", features: selected.map((i) => review.geometry.features[i]) };
  const summary = geometrySummary(geometry);
  let problem = "";
  try {
    prepareMapImport(review.geometry, selected, target);
  } catch (error) {
    problem = error.message;
  }
  const existing = Boolean(
    mission?.[target] && (Object.hasOwn(MAP_POINTS, target) || mission[target].features?.length)
  );
  const stale = !mission || mission.id !== review.missionId || mission.editToken !== review.editToken;
  return (
    <dialog
      ref={ref}
      className="drone-export-dialog boundary-import-dialog"
      aria-labelledby="boundary-import-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="field-section-head">
        <div>
          <h2 id="boundary-import-title" tabIndex={-1}>
            Review map import
          </h2>
          <p>{review.filename}</p>
        </div>
        <button type="button" aria-label="Close map import" onClick={onClose} disabled={busy}>
          ×
        </button>
      </div>
      <p>Choose the features to keep and where to place them. Your saved plan changes only when you confirm.</p>
      {review.notice && <p role="alert">{review.notice}</p>}
      {stale && (
        <p role="alert">
          The mission changed while this preview was open. Cancel and import again to review the latest plan.
        </p>
      )}
      <div className="boundary-import-layout">
        <div>
          <label className="map-destination">
            Import into
            <select
              aria-label="Import into"
              value={target}
              disabled={busy}
              onChange={(e) => {
                setTarget(e.target.value);
                setReplace(false);
              }}
            >
              {Object.entries(MAP_DESTINATIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="boundary-feature-list" disabled={busy}>
            <legend>
              Features ({selected.length} of {review.geometry.features.length} selected)
            </legend>
            {review.geometry.features.map((feature, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  aria-label={`Include ${feature.properties.name}`}
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked ? [...prev, i].sort((a, b) => a - b) : prev.filter((n) => n !== i)
                    )
                  }
                />
                <span>
                  <strong>{feature.properties.name}</strong>
                  <small>
                    {feature.geometry.type} · {feature.properties.altitudeMode}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="drone-note">
            {summary.polygonCount} polygon(s) · {(summary.areaM2 / 10000).toFixed(2)} ha ·{" "}
            {Math.round(summary.perimeterM)} m perimeter
          </p>
          {summary.hasLines && (
            <p className="drone-note">Lines have no area. Define a corridor and operating areas separately.</p>
          )}
        </div>
        <DroneMap
          key={review.filename}
          mission={{ regionCode: mission?.regionCode, boundary: geometry }}
          readOnly
          preview
        />
      </div>
      <p className="drone-note">
        WGS84 longitude/latitude. Polygon holes and geometry altitudes are retained. Point destinations use horizontal
        coordinates only; imported altitude is not flight height.
      </p>
      {problem && (
        <p className="drone-warning" role="status">
          {problem}
        </p>
      )}
      {existing && (
        <label className="boundary-replace">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} disabled={busy} />
          Replace the existing {MAP_DESTINATIONS[target].toLowerCase()} with this selection.
        </label>
      )}
      <div className="drone-actions export-review-footer">
        <button type="button" disabled={busy} onClick={onClose}>
          Cancel import
        </button>
        <button
          type="button"
          className="drone-primary"
          disabled={busy || stale || !!problem || (existing && !replace)}
          onClick={() => onConfirm(selected, target)}
        >
          Import selected features
        </button>
      </div>
    </dialog>
  );
}
