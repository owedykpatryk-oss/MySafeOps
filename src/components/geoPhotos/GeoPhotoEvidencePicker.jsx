import { useMemo } from "react";
import { ms } from "../../utils/moduleStyles";
import { geoPhotoPreset } from "../../utils/geoPhotoPresets";
import { geoPhotoDisplayUrl } from "../../utils/geoPhotoMedia";
import { resolvedGiLocationId } from "../../utils/geoPhotoFields";

/**
 * Pick an existing geo-photo as permit site evidence.
 */
export default function GeoPhotoEvidencePicker({ open, onClose, photos = [], projectId = "", onPick }) {
  const list = useMemo(() => {
    const rows = (photos || []).filter((p) => !projectId || p.projectId === projectId);
    return rows
      .filter((p) => geoPhotoDisplayUrl(p))
      .sort((a, b) => new Date(b.timestampUtc || b.createdAt).getTime() - new Date(a.timestampUtc || a.createdAt).getTime());
  }, [photos, projectId]);

  if (!open) return null;

  return (
    <div className="geo-photo-modal-backdrop" role="dialog" aria-modal="true">
      <div className="geo-photo-modal" style={{ maxWidth: 520 }}>
        <div className="geo-photo-modal__head">
          <h3 className="geo-photo-modal__title">Pick geo-photo as evidence</h3>
          <button type="button" style={ms.btn} onClick={onClose}>
            Close
          </button>
        </div>
        {!projectId ? (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Select a project on the permit first.</p>
        ) : list.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            No geo-photos on this project yet — capture one from the field or open Geo-photos.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, maxHeight: 360, overflow: "auto" }}>
            {list.map((p) => {
              const preset = geoPhotoPreset(p.type);
              const loc = resolvedGiLocationId(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    style={{
                      ...ms.btn,
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: 8,
                    }}
                  >
                    <img
                      src={geoPhotoDisplayUrl(p)}
                      alt=""
                      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong>
                        {preset.icon} {preset.label}
                      </strong>
                      {loc ? <span style={{ marginLeft: 6, opacity: 0.85 }}>{loc}</span> : null}
                      <br />
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                        {(p.notes || "").slice(0, 80)}
                        {(p.notes || "").length > 80 ? "…" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
