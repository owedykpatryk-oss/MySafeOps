import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ms } from "../../utils/moduleStyles";
import GeoPhotoDirectionMap from "./GeoPhotoDirectionMap";
import { presetsByGroup, geoPhotoPreset } from "../../utils/geoPhotoPresets";
import {
  blankGeoPhoto,
  compressImageFile,
  flipBearing180,
  normalizeBearing,
  requestDeviceLocation,
  watchCompassBearing,
} from "../../utils/geoPhotoUtils";
import { findNearestProject } from "../../utils/geoPhotoIntegrations";

const LAST_PRESET_KEY = "mysafeops_geo_photo_last_preset";
const STEPS = ["photo", "location", "details"];

function stepClass(current, index, stepIdx) {
  if (current === STEPS[index]) return "geo-photo-capture__step geo-photo-capture__step--active";
  if (index < stepIdx) return "geo-photo-capture__step geo-photo-capture__step--done";
  return "geo-photo-capture__step";
}

export default function GeoPhotoCaptureModal({
  open,
  onClose,
  onSave,
  projects = [],
  initialProjectId = "",
  saving = false,
}) {
  const [step, setStep] = useState("photo");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [compassBearing, setCompassBearing] = useState(null);
  const [manualBearing, setManualBearing] = useState(null);
  const [type, setType] = useState(() => {
    try {
      const stored = localStorage.getItem(LAST_PRESET_KEY);
      return stored || "general_site_condition";
    } catch {
      return "general_site_condition";
    }
  });
  const [notes, setNotes] = useState("");
  const [includeInReport, setIncludeInReport] = useState(true);
  const [projectId, setProjectId] = useState(initialProjectId || "");
  const [capturedBy, setCapturedBy] = useState("");
  const [autoProjectHint, setAutoProjectHint] = useState("");
  const fileRef = useRef(null);

  const effectiveBearing = manualBearing ?? compassBearing;
  const preset = geoPhotoPreset(type);
  const groupedPresets = useMemo(() => presetsByGroup(), []);

  const reset = useCallback(() => {
    setStep("photo");
    setPhotoDataUrl("");
    setPhotoName("");
    setLatitude(null);
    setLongitude(null);
    setGpsAccuracyMeters(null);
    setGpsError("");
    setCompassBearing(null);
    setManualBearing(null);
    setNotes("");
    setIncludeInReport(true);
    setProjectId(initialProjectId || "");
    setCapturedBy("");
    setAutoProjectHint("");
  }, [initialProjectId]);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || step !== "location") return undefined;
    return watchCompassBearing((b) => setCompassBearing(b));
  }, [open, step]);

  useEffect(() => {
    if (open && initialProjectId) setProjectId(initialProjectId);
  }, [open, initialProjectId]);

  const acquireGps = async () => {
    setGpsBusy(true);
    setGpsError("");
    try {
      const pos = await requestDeviceLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setGpsAccuracyMeters(pos.accuracy ?? null);
      const near = findNearestProject(pos.latitude, pos.longitude, projects);
      if (near && !projectId && !initialProjectId) {
        setProjectId(near.project.id);
        setAutoProjectHint(`Auto-selected ${near.project.name || "project"} (~${near.distanceMeters} m away)`);
      }
    } catch (e) {
      setGpsError(e.message || "Could not get GPS");
      const proj = projects.find((p) => p.id === projectId);
      if (proj?.lat != null && proj?.lng != null) {
        setLatitude(Number(proj.lat));
        setLongitude(Number(proj.lng));
        setGpsAccuracyMeters(null);
        setGpsError("Using project site coordinates (GPS unavailable).");
      }
    } finally {
      setGpsBusy(false);
    }
  };

  useEffect(() => {
    if (open && step === "location" && latitude == null) acquireGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setPhotoDataUrl(dataUrl);
      setPhotoName(file.name);
      setStep("location");
    } catch {
      setGpsError("Could not read photo");
    }
  };

  const handleSave = (takeAnother = false) => {
    const proj = projects.find((p) => p.id === projectId);
    const row = blankGeoPhoto({
      projectId: projectId || "",
      projectName: proj?.name || "",
      type,
      latitude,
      longitude,
      gpsAccuracyMeters,
      bearing: effectiveBearing,
      notes: notes.trim(),
      includeInReport,
      photoDataUrl,
      capturedBy: capturedBy.trim(),
      timestampUtc: new Date().toISOString(),
    });
    try {
      localStorage.setItem(LAST_PRESET_KEY, type);
    } catch {
      /* ignore */
    }
    onSave(row, { takeAnother });
    if (takeAnother) {
      setStep("photo");
      setPhotoDataUrl("");
      setPhotoName("");
      setNotes("");
      acquireGps();
    } else {
      onClose();
    }
  };

  if (!open) return null;

  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="geo-photo-capture-backdrop" role="dialog" aria-modal="true" aria-labelledby="geo-photo-capture-title">
      <div className="geo-photo-capture">
        <div className="geo-photo-modal__head">
          <div>
            <div className="geo-photo-capture__eyebrow">Field capture</div>
            <h2 id="geo-photo-capture-title" className="geo-photo-modal__title">
              Add geo-photo
            </h2>
            <p className="geo-photo-capture__hint">Photo → GPS → direction arrow → type &amp; notes.</p>
          </div>
          <button type="button" onClick={onClose} style={{ ...ms.btn, padding: "8px 12px", minHeight: 36 }}>
            Close
          </button>
        </div>

        <div className="geo-photo-capture__steps" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={stepClass(step, i, stepIdx)} title={s} />
              {i < STEPS.length - 1 ? <span className="geo-photo-capture__step-line" /> : null}
            </span>
          ))}
        </div>

        {step === "photo" ? (
          <div>
            {photoDataUrl ? (
              <img src={photoDataUrl} alt={photoName || "Captured"} className="geo-photo-modal__preview" />
            ) : (
              <button type="button" className="geo-photo-capture__dropzone" onClick={() => fileRef.current?.click()}>
                <span className="geo-photo-capture__dropzone-icon" aria-hidden>
                  📷
                </span>
                Take or choose photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPickPhoto} />
            {photoDataUrl ? (
              <div className="geo-photo-capture__actions">
                <button type="button" style={ms.btn} onClick={() => fileRef.current?.click()}>
                  Retake
                </button>
                <button type="button" style={ms.btnP} onClick={() => setStep("location")}>
                  Next — location
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "location" ? (
          <div>
            <div className="geo-photos-card__map">
              <GeoPhotoDirectionMap
                latitude={latitude}
                longitude={longitude}
                accuracyMeters={gpsAccuracyMeters}
                bearing={effectiveBearing}
                arrowColor={preset.color}
                height={200}
                interactive
              />
            </div>
            <p className="geo-photo-capture__hint">
              {latitude != null && longitude != null ? (
                <>
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  {gpsAccuracyMeters != null ? ` · ±${Math.round(gpsAccuracyMeters)} m` : ""}
                </>
              ) : (
                "Waiting for GPS…"
              )}
            </p>
            {gpsError ? <p className="geo-photo-capture__hint geo-photo-capture__hint--warn">{gpsError}</p> : null}
            <div className="geo-photo-capture__actions">
              <button type="button" style={ms.btn} onClick={acquireGps} disabled={gpsBusy}>
                {gpsBusy ? "Getting GPS…" : "Refresh GPS"}
              </button>
              <button type="button" style={ms.btn} onClick={() => setStep("photo")}>
                Back
              </button>
              <button type="button" style={ms.btnP} disabled={latitude == null || longitude == null} onClick={() => setStep("details")}>
                Next — details
              </button>
            </div>

            <div className="geo-photo-capture__panel">
              <div className="geo-photo-capture__panel-title">Camera direction</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <label className="geo-photos-toolbar__field" style={{ margin: 0 }}>
                  Bearing °
                  <input
                    type="number"
                    min={0}
                    max={359}
                    value={manualBearing ?? compassBearing ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setManualBearing(v === "" ? null : normalizeBearing(Number(v)));
                    }}
                    style={{ ...ms.inp, width: 88 }}
                  />
                </label>
                <button type="button" style={ms.btn} onClick={() => setManualBearing(compassBearing)}>
                  Use compass
                </button>
                <button type="button" style={ms.btn} onClick={() => setManualBearing(flipBearing180(effectiveBearing ?? 0))}>
                  Flip 180°
                </button>
              </div>
              <p className="geo-photo-capture__hint">0° = north. Hold phone level for compass.</p>
            </div>
          </div>
        ) : null}

        {step === "details" ? (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
              ) : null}
              <div className="geo-photos-card__map" style={{ flex: 1 }}>
                <GeoPhotoDirectionMap
                  latitude={latitude}
                  longitude={longitude}
                  bearing={effectiveBearing}
                  arrowColor={preset.color}
                  height={72}
                  interactive={false}
                />
              </div>
            </div>

            {autoProjectHint ? <p className="geo-photo-capture__hint geo-photo-capture__hint--ok">{autoProjectHint}</p> : null}
            <label className="geo-photos-toolbar__field">
              Project
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={ms.inp}>
                <option value="">— No project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "Untitled"}
                  </option>
                ))}
              </select>
            </label>
            <label className="geo-photos-toolbar__field">
              Type
              <select value={type} onChange={(e) => setType(e.target.value)} style={ms.inp}>
                {groupedPresets.map(({ group, presets }) => (
                  <optgroup key={group} label={group}>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="geo-photos-toolbar__field">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Access from north gate, locked barrier, etc."
                style={{ ...ms.inp, resize: "vertical" }}
              />
            </label>
            <label className="geo-photos-toolbar__field">
              Captured by (optional)
              <input value={capturedBy} onChange={(e) => setCapturedBy(e.target.value)} style={ms.inp} />
            </label>
            <label className={`geo-photos-card__report ${includeInReport ? "geo-photos-card__report--on" : ""}`} style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={includeInReport} onChange={(e) => setIncludeInReport(e.target.checked)} />
              Include in report
            </label>
            <div className="geo-photo-capture__actions">
              <button type="button" style={ms.btn} onClick={() => setStep("location")}>
                Back
              </button>
              <button type="button" style={ms.btnP} disabled={saving} onClick={() => handleSave(false)}>
                {saving ? "Saving…" : "Save geo-photo"}
              </button>
              <button type="button" style={ms.btn} disabled={saving} onClick={() => handleSave(true)}>
                Save &amp; another
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
