import { useEffect, useState } from "react";
import { ms } from "../../utils/moduleStyles";
import GeoPhotoAreaMap from "./GeoPhotoAreaMap";
import {
  AREA_OFFSET_WARN_M,
  MIN_AREA_VERTICES,
  formatAreaSqm,
  formatLengthM,
  geoPhotoAreaDraft,
  geoPhotoAreaOffsetM,
  geoPhotoAreaPrompt,
  geoPhotoTypeWantsArea,
  normaliseAreaPoints,
} from "../../utils/geoPhotoArea";

const samePoints = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Optional boundary for a photo, shared by the capture wizard and the detail editor so both
 * draw and measure the same way. The value travels as the draft shape from `geoPhotoArea`,
 * partial rings included, and is only tightened into a saved extent when the row is written.
 */
export default function GeoPhotoAreaPanel({
  type,
  latitude,
  longitude,
  color = "#16a34a",
  value = null,
  onChange,
  title = "Extent on the map",
}) {
  const incoming = normaliseAreaPoints(value?.points);
  const [points, setPoints] = useState(incoming);
  const [open, setOpen] = useState(incoming.length > 0);
  const [satellite, setSatellite] = useState(true);

  // Follows the row being edited — switching photo replaces the shape rather than merging it.
  useEffect(() => {
    const next = normaliseAreaPoints(value?.points);
    setPoints((prev) => (samePoints(prev, next) ? prev : next));
    if (next.length) setOpen(true);
  }, [value]);

  const apply = (next) => {
    const ring = normaliseAreaPoints(next);
    setPoints(ring);
    onChange(geoPhotoAreaDraft(ring));
  };

  const draft = geoPhotoAreaDraft(points);
  const closed = points.length >= MIN_AREA_VERTICES;
  const wanted = geoPhotoTypeWantsArea(type);
  // Nothing else catches a boundary traced on the wrong field after the map has been panned.
  const offsetM = closed ? geoPhotoAreaOffsetM({ latitude, longitude, area: draft }) : null;
  const strayed = offsetM != null && offsetM > AREA_OFFSET_WARN_M;

  if (!open) {
    return (
      <div className="geo-photo-capture__panel" style={{ marginBottom: 12 }}>
        <div className="geo-photo-capture__panel-title">{title}</div>
        <p className="geo-photo-capture__hint">
          {wanted ? geoPhotoAreaPrompt(type) : "Optional — outline the ground this photo is about to record its size."}
        </p>
        <button
          type="button"
          style={{ ...(wanted ? ms.btnP : ms.btn), minHeight: 44, touchAction: "manipulation" }}
          onClick={() => setOpen(true)}
        >
          ✏️ Draw extent on map
        </button>
      </div>
    );
  }

  return (
    <div className="geo-photo-capture__panel" style={{ marginBottom: 12 }}>
      <div className="geo-photo-capture__panel-title">{title}</div>
      <p className="geo-photo-capture__hint">
        {geoPhotoAreaPrompt(type)} Tap the map to drop corners, drag to adjust, tap a corner to remove it.
      </p>
      <div className="geo-photos-card__map" style={{ marginBottom: 8 }}>
        <GeoPhotoAreaMap
          points={points}
          onChange={apply}
          latitude={latitude}
          longitude={longitude}
          color={color}
          satellite={satellite}
          height={260}
        />
      </div>
      <p className={`geo-photo-capture__hint ${closed ? "geo-photo-capture__hint--ok" : ""}`}>
        {closed
          ? `${points.length} corners · ${formatAreaSqm(draft.sqm)} · ${formatLengthM(draft.perimeterM)} perimeter`
          : `${points.length} of ${MIN_AREA_VERTICES} corners — the shape closes itself once there are three.`}
      </p>
      {strayed ? (
        <p className="geo-photo-capture__hint geo-photo-capture__hint--warn">
          This extent sits about {offsetM} m from where the photo was taken — check the map was not panned onto
          different ground.
        </p>
      ) : null}
      <div className="geo-photo-capture__actions">
        <button
          type="button"
          style={{ ...ms.btn, minHeight: 44, touchAction: "manipulation" }}
          onClick={() => setSatellite((s) => !s)}
        >
          {satellite ? "Street map" : "Satellite"}
        </button>
        <button
          type="button"
          style={{ ...ms.btn, minHeight: 44, touchAction: "manipulation" }}
          disabled={!points.length}
          onClick={() => apply(points.slice(0, -1))}
        >
          Undo corner
        </button>
        <button
          type="button"
          style={{ ...ms.btn, minHeight: 44, touchAction: "manipulation" }}
          disabled={!points.length}
          onClick={() => apply([])}
        >
          Clear
        </button>
        <button
          type="button"
          style={{ ...ms.btn, minHeight: 44, touchAction: "manipulation" }}
          onClick={() => {
            if (!points.length) setOpen(false);
            else if (window.confirm("Remove the extent drawn on this photo?")) {
              apply([]);
              setOpen(false);
            }
          }}
        >
          {points.length ? "Remove extent" : "Hide map"}
        </button>
      </div>
    </div>
  );
}
