import { projectDisplayLabel } from "../../utils/projectDisplayLabel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ms } from "../../utils/moduleStyles";
import GeoPhotoDirectionMap from "./GeoPhotoDirectionMap";
import GeoPhotoTypeFieldInputs from "./GeoPhotoTypeFieldInputs";
import GeoPhotoAreaPanel from "./GeoPhotoAreaPanel";
import { presetsByGroup, geoPhotoPreset, geoPhotoPresetLabel } from "../../utils/geoPhotoPresets";
import { getOrgIndustryPackId } from "../../utils/surveyWorkflowGate";
import {
  blankGeoPhoto,
  compassNeedsUserGesture,
  compressImageFile,
  flipBearing180,
  GPS_GOOD_ACCURACY_M,
  isCoarseGpsAccuracy,
  newGeoPhotoId,
  normalizeBearing,
  photoReadErrorMessage,
  readPhotoExifLocation,
  requestCompassPermission,
  requestDeviceLocation,
  watchBetterLocation,
  watchCompassBearing,
} from "../../utils/geoPhotoUtils";
import { wgs84ToBritishNationalGrid } from "../../utils/britishNationalGrid";
import { uploadGeoPhotoToR2 } from "../../utils/geoPhotoMedia";
import { findNearestProject, findRecentDuplicateGeoPhoto } from "../../utils/geoPhotoIntegrations";
import { normaliseGeoPhotoDetails } from "../../utils/geoPhotoTypeFields";
import { normaliseGeoPhotoArea } from "../../utils/geoPhotoArea";
import { geoPhotoLocationErrorMessage, geoPhotoLocationStatus } from "../../utils/geoPhotoLocationStatus.js";
import {
  isGiGeoPhotoType,
  buildStructuredGeoPhotoNotes,
  CAPTURE_PHASE_OPTIONS,
} from "../../utils/geoPhotoFields";
import { useToast } from "../../context/ToastContext";
import { countryOperationalStorageKey, ORG_CHANGED_EVENT } from "../../utils/orgStorage";
import { COUNTRY_WORKSPACE_CHANGED_EVENT } from "../../utils/countryWorkspaces";

import { CAPTURE_DRAFT_KEY, readSessionCaptureDraft, readCaptureDraft, writeCaptureDraft, clearCaptureDraft } from "../../utils/geoPhotoCaptureDraft";

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
  onCreateProject,
  projects = [],
  photos = [],
  initialProjectId = "",
  initialPreset = "",
  linkedPermitId = "",
}) {
  const { pushToast } = useToast();
  const [step, setStep] = useState("photo");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoScope, setPhotoScope] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [draftWarning, setDraftWarning] = useState("");
  const savedPhotosRef = useRef(photos);
  savedPhotosRef.current = photos;
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState(null);
  const [altitudeMeters, setAltitudeMeters] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsWaiting, setGpsWaiting] = useState(false);
  const [locationSource, setLocationSource] = useState("");
  const [exifLocation, setExifLocation] = useState(null);
  const [compassBearing, setCompassBearing] = useState(null);
  const [manualBearing, setManualBearing] = useState(null);
  const [type, setType] = useState(() => {
    if (initialPreset) return initialPreset;
    try {
      const stored = localStorage.getItem(LAST_PRESET_KEY);
      return stored || "general_site_condition";
    } catch {
      return "general_site_condition";
    }
  });
  const [notes, setNotes] = useState("");
  const [locationId, setLocationId] = useState("");
  const [depthM, setDepthM] = useState("");
  const [sampleRef, setSampleRef] = useState("");
  const [capturePhase, setCapturePhase] = useState("");
  const [details, setDetails] = useState({});
  const [area, setArea] = useState(null);
  const [includeInReport, setIncludeInReport] = useState(true);
  const [projectId, setProjectId] = useState(initialProjectId || "");
  const [capturedBy, setCapturedBy] = useState("");
  const [autoProjectHint, setAutoProjectHint] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickError, setQuickError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const compassCleanupRef = useRef(null);
  const wasOpenRef = useRef(false);
  const savingRef = useRef(false);
  const photoRequestRef = useRef(0);
  const locationRequestRef = useRef(0);
  const captureScopeRef = useRef(countryOperationalStorageKey(CAPTURE_DRAFT_KEY));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // One id per capture, so a double tap or a restored draft updates the same row
  // instead of creating a second copy of the same photo.
  const captureIdRef = useRef(newGeoPhotoId());

  const effectiveBearing = manualBearing ?? compassBearing;
  const nationalGrid = useMemo(() => wgs84ToBritishNationalGrid(latitude, longitude), [latitude, longitude]);
  const preset = geoPhotoPreset(type);
  // The workspace's trade brings its own capture types to the top of the list; nothing is hidden.
  const groupedPresets = useMemo(() => presetsByGroup(getOrgIndustryPackId()), []);
  const showGiFields = isGiGeoPhotoType(type);

  const reset = useCallback(() => {
    photoRequestRef.current += 1;
    locationRequestRef.current += 1;
    setStep("photo");
    setPhotoDataUrl("");
    setPhotoScope("");
    setPhotoName("");
    setPhotoBusy(false);
    setPhotoError("");
    setLatitude(null);
    setLongitude(null);
    setGpsAccuracyMeters(null);
    setAltitudeMeters(null);
    setGpsError("");
    setGpsBusy(false);
    setGpsWaiting(false);
    setLocationSource("");
    setExifLocation(null);
    setCompassBearing(null);
    setManualBearing(null);
    setNotes("");
    setLocationId("");
    setDepthM("");
    setSampleRef("");
    setCapturePhase("");
    setDetails({});
    setArea(null);
    setIncludeInReport(true);
    setProjectId(initialProjectId || "");
    setCapturedBy("");
    setAutoProjectHint("");
    setQuickOpen(false);
    setQuickName("");
    setQuickAddress("");
    setQuickError("");
    setSaveError("");
    setSaving(false);
    savingRef.current = false;
    captureIdRef.current = newGeoPhotoId();
    const presetId =
      initialPreset ||
      (() => {
        try {
          return localStorage.getItem(LAST_PRESET_KEY) || "general_site_condition";
        } catch {
          return "general_site_condition";
        }
      })();
    setType(presetId);
  }, [initialProjectId, initialPreset]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    if (!open && wasOpen) {
      photoRequestRef.current += 1;
      locationRequestRef.current += 1;
    }
    if (open && !wasOpen) {
      setDraftWarning("");
      captureScopeRef.current = countryOperationalStorageKey(CAPTURE_DRAFT_KEY);
      const scope = captureScopeRef.current;
      const applyDraft = (draft) => {
        if (!draft?.photoDataUrl) return;
        if (savedPhotosRef.current.some((photo) => photo?.id === draft.captureId && !photo.deletedAt)) {
          reset();
          void clearCaptureDraft(scope);
          return;
        }
        captureIdRef.current = draft.captureId || newGeoPhotoId();
        setStep(STEPS.includes(draft.step) ? draft.step : "location");
        setPhotoDataUrl(draft.photoDataUrl);
        setPhotoScope(captureScopeRef.current);
        setPhotoName(draft.photoName || "");
        setPhotoBusy(false);
        setPhotoError("");
        setLatitude(draft.latitude ?? null);
        setLongitude(draft.longitude ?? null);
        setGpsAccuracyMeters(draft.gpsAccuracyMeters ?? null);
        setAltitudeMeters(draft.altitudeMeters ?? null);
        setGpsError(draft.gpsError || "");
        setGpsBusy(false);
        setGpsWaiting(false);
        setLocationSource(draft.locationSource || "");
        setExifLocation(draft.exifLocation ?? null);
        setCompassBearing(draft.compassBearing ?? null);
        setManualBearing(draft.manualBearing ?? null);
        setType(draft.type || "general_site_condition");
        setNotes(draft.notes || "");
        setLocationId(draft.locationId || "");
        setDepthM(draft.depthM || "");
        setSampleRef(draft.sampleRef || "");
        setCapturePhase(draft.capturePhase || "");
        setDetails(draft.details && typeof draft.details === "object" ? draft.details : {});
        setArea(draft.area ?? null);
        setIncludeInReport(draft.includeInReport ?? true);
        setProjectId(draft.projectId || initialProjectId || "");
        setCapturedBy(draft.capturedBy || "");
        setAutoProjectHint(draft.autoProjectHint || "");
        setQuickOpen(false);
        setQuickName("");
        setQuickAddress("");
        setQuickError("");
        setSaveError("");
      };
      const draft = readSessionCaptureDraft(scope);
      if (draft) applyDraft(draft);
      else {
        reset();
        const requestId = photoRequestRef.current;
        void readCaptureDraft(scope).then((stored) => {
          if (wasOpenRef.current && photoRequestRef.current === requestId &&
              countryOperationalStorageKey(CAPTURE_DRAFT_KEY) === scope) applyDraft(stored);
        });
      }
    }
    wasOpenRef.current = open;
  }, [open, reset, initialProjectId]);

  useEffect(() => {
    const closeForWorkspaceChange = () => {
      photoRequestRef.current += 1;
      locationRequestRef.current += 1;
      onCloseRef.current?.();
    };
    window.addEventListener(ORG_CHANGED_EVENT, closeForWorkspaceChange);
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, closeForWorkspaceChange);
    return () => {
      photoRequestRef.current += 1;
      locationRequestRef.current += 1;
      window.removeEventListener(ORG_CHANGED_EVENT, closeForWorkspaceChange);
      window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, closeForWorkspaceChange);
    };
  }, []);

  useEffect(() => {
    if (!open || step !== "location") {
      compassCleanupRef.current?.();
      compassCleanupRef.current = null;
      return undefined;
    }
    if (compassNeedsUserGesture()) return undefined;
    compassCleanupRef.current = watchCompassBearing((b) => setCompassBearing(b));
    return () => {
      compassCleanupRef.current?.();
      compassCleanupRef.current = null;
    };
  }, [open, step]);

  useEffect(() => {
    const handleCameraCancel = () => {
      setPhotoError(
        "The camera was closed. If it will not open, allow camera or photo access for your browser in device settings, or choose an existing photo."
      );
    };
    const handleLibraryCancel = () => {
      setPhotoError(
        "The photo picker was closed. If access is blocked, allow photo access for your browser in device settings, then try again."
      );
    };
    const cameraInput = cameraRef.current;
    const libraryInput = libraryRef.current;
    cameraInput?.addEventListener("cancel", handleCameraCancel);
    libraryInput?.addEventListener("cancel", handleLibraryCancel);
    return () => {
      cameraInput?.removeEventListener("cancel", handleCameraCancel);
      libraryInput?.removeEventListener("cancel", handleLibraryCancel);
    };
  }, [open, step]);

  const enableCompass = async () => {
    const ok = await requestCompassPermission();
    if (!ok) {
      setGpsError("Compass permission denied — enter bearing manually or use Flip 180°.");
      return;
    }
    compassCleanupRef.current?.();
    compassCleanupRef.current = watchCompassBearing((b) => setCompassBearing(b), { autoRequestPermission: false });
  };

  useEffect(() => {
    if (open && initialProjectId) setProjectId(initialProjectId);
  }, [open, initialProjectId]);

  useEffect(() => {
    if (!open || !photoDataUrl || photoScope !== captureScopeRef.current) return;
    const scope = captureScopeRef.current;
    let cancelled = false;
    void writeCaptureDraft({
      captureId: captureIdRef.current,
      step,
      photoDataUrl,
      photoName,
      latitude,
      longitude,
      gpsAccuracyMeters,
      altitudeMeters,
      gpsError,
      locationSource,
      exifLocation,
      compassBearing,
      manualBearing,
      type,
      notes,
      locationId,
      depthM,
      sampleRef,
      capturePhase,
      details,
      area,
      includeInReport,
      projectId,
      capturedBy,
      autoProjectHint,
    }, scope).then((saved) => {
      if (!cancelled && wasOpenRef.current && captureScopeRef.current === scope) {
        setDraftWarning(saved ? "" : "Browser restart recovery is unavailable. Keep this window open until the photo is saved.");
      }
    });
    return () => { cancelled = true; };
  }, [
    open,
    step,
    photoDataUrl,
    photoScope,
    photoName,
    latitude,
    longitude,
    gpsAccuracyMeters,
    altitudeMeters,
    gpsError,
    locationSource,
    exifLocation,
    compassBearing,
    manualBearing,
    type,
    notes,
    locationId,
    depthM,
    sampleRef,
    capturePhase,
    details,
    area,
    includeInReport,
    projectId,
    capturedBy,
    autoProjectHint,
  ]);

  const autoSelectNearestProject = (lat, lng) => {
    const near = findNearestProject(lat, lng, projects);
    if (near && !projectId && !initialProjectId) {
      setProjectId(near.project.id);
      setAutoProjectHint(`Auto-selected ${near.project.name || "project"} (~${near.distanceMeters} m away)`);
    }
  };

  const acquireGps = async () => {
    const requestId = ++locationRequestRef.current;
    const scope = captureScopeRef.current;
    const isCurrent = () => requestId === locationRequestRef.current && wasOpenRef.current && scope === countryOperationalStorageKey(CAPTURE_DRAFT_KEY);
    setGpsBusy(true);
    setGpsError("");
    try {
      const pos = await requestDeviceLocation();
      if (!isCurrent()) return;
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setGpsAccuracyMeters(pos.accuracy ?? null);
      setAltitudeMeters(pos.altitude ?? null);
      setLocationSource("device_gps");
      autoSelectNearestProject(pos.latitude, pos.longitude);
    } catch (e) {
      if (!isCurrent()) return;
      setGpsError(geoPhotoLocationErrorMessage(e));
      if (exifLocation) {
        setLatitude(exifLocation.latitude);
        setLongitude(exifLocation.longitude);
        setGpsAccuracyMeters(null);
        setAltitudeMeters(exifLocation.altitude ?? null);
        setLocationSource("photo_exif");
        autoSelectNearestProject(exifLocation.latitude, exifLocation.longitude);
        return;
      }
      const proj = projects.find((p) => p.id === projectId);
      if (proj?.lat != null && proj?.lng != null) {
        setLatitude(Number(proj.lat));
        setLongitude(Number(proj.lng));
        setGpsAccuracyMeters(null);
        setLocationSource("project_site");
      }
    } finally {
      if (isCurrent()) setGpsBusy(false);
    }
  };

  const waitForBetterGps = async () => {
    const requestId = ++locationRequestRef.current;
    const scope = captureScopeRef.current;
    const isCurrent = () => requestId === locationRequestRef.current && wasOpenRef.current && scope === countryOperationalStorageKey(CAPTURE_DRAFT_KEY);
    setGpsWaiting(true);
    setGpsError("");
    try {
      const fix = await watchBetterLocation({
        onUpdate: (f) => {
          if (!isCurrent()) return;
          setLatitude(f.latitude);
          setLongitude(f.longitude);
          setGpsAccuracyMeters(f.accuracy ?? null);
          setAltitudeMeters(f.altitude ?? null);
          setLocationSource("device_gps");
        },
      });
      if (!isCurrent()) return;
      autoSelectNearestProject(fix.latitude, fix.longitude);
      if (isCoarseGpsAccuracy(fix.accuracy)) {
        setGpsError(`Best fix was ±${Math.round(fix.accuracy)} m — move into the open or drop the pin by hand.`);
      }
    } catch (e) {
      if (!isCurrent()) return;
      setGpsError(geoPhotoLocationErrorMessage(e));
    } finally {
      if (isCurrent()) setGpsWaiting(false);
    }
  };

  const useExifLocation = () => {
    if (!exifLocation) return;
    locationRequestRef.current += 1;
    setGpsBusy(false);
    setGpsWaiting(false);
    setLatitude(exifLocation.latitude);
    setLongitude(exifLocation.longitude);
    setGpsAccuracyMeters(null);
    setAltitudeMeters(exifLocation.altitude ?? null);
    setLocationSource("photo_exif");
    setGpsError("");
    autoSelectNearestProject(exifLocation.latitude, exifLocation.longitude);
  };

  useEffect(() => {
    if (open && step === "location" && latitude == null) acquireGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const requestId = ++photoRequestRef.current;
    locationRequestRef.current += 1;
    const scope = captureScopeRef.current;
    const isCurrent = () => requestId === photoRequestRef.current && wasOpenRef.current && scope === countryOperationalStorageKey(CAPTURE_DRAFT_KEY);
    setPhotoBusy(true);
    setPhotoError("");
    try {
      // EXIF must come from the original file — compression re-encodes and drops metadata.
      const [dataUrl, exif] = await Promise.all([compressImageFile(file), readPhotoExifLocation(file)]);
      if (!isCurrent()) return;
      setPhotoDataUrl(dataUrl);
      setPhotoScope(scope);
      setPhotoName(file.name);
      setExifLocation(exif);
      writeCaptureDraft({
        captureId: captureIdRef.current,
        step: "location",
        photoDataUrl: dataUrl,
        photoName: file.name,
        latitude,
        longitude,
        gpsAccuracyMeters,
        altitudeMeters,
        gpsError,
        locationSource,
        exifLocation: exif,
        compassBearing,
        manualBearing,
        type,
        notes,
        locationId,
        depthM,
        sampleRef,
        capturePhase,
        includeInReport,
        projectId,
        capturedBy,
        autoProjectHint,
      }, scope);
      setStep("location");
      pushToast({
        type: "info",
        title: "Photo captured",
        message: "Complete location and details, then tap Save to add it to Geo-Photos.",
      });
    } catch {
      if (isCurrent()) setPhotoError(photoReadErrorMessage(file));
    } finally {
      if (isCurrent()) setPhotoBusy(false);
    }
  };

  const submitQuickProject = () => {
    if (!onCreateProject) return;
    const name = quickName.trim();
    if (!name) {
      setQuickError("Enter a site or project name.");
      return;
    }
    const created = onCreateProject({ name, address: quickAddress.trim(), latitude, longitude });
    if (!created?.id) {
      setQuickError("Could not create the project — check your plan limits in Settings → Billing.");
      return;
    }
    setProjectId(created.id);
    setQuickOpen(false);
    setQuickName("");
    setQuickAddress("");
    setQuickError("");
    setSaveError("");
    setAutoProjectHint(`Linked to ${created.name} — add client, dates and risks in Projects later.`);
  };

  const handleSave = async (takeAnother = false) => {
    if (savingRef.current) return; // Cloud upload can take seconds; a second tap must not add a copy.
    setSaveError("");
    if (!photoDataUrl) {
      setPhotoError("Add a photo before saving.");
      setStep("photo");
      return;
    }
    const proj = projects.find((p) => p.id === projectId);
    const depthVal = depthM === "" ? null : Number(depthM);
    const mergedNotes = buildStructuredGeoPhotoNotes({
      notes: notes.trim(),
      locationId: locationId.trim(),
      depthM: Number.isFinite(depthVal) ? depthVal : null,
      sampleRef: sampleRef.trim(),
      capturePhase,
    });
    const row = blankGeoPhoto({
      id: captureIdRef.current,
      projectId: projectId || "",
      projectName: proj?.name || "",
      type,
      latitude,
      longitude,
      gpsAccuracyMeters,
      altitudeMeters,
      locationSource,
      bearing: effectiveBearing,
      notes: mergedNotes,
      locationId: locationId.trim().toUpperCase(),
      depthM: Number.isFinite(depthVal) ? depthVal : null,
      sampleRef: sampleRef.trim(),
      capturePhase,
      details: normaliseGeoPhotoDetails(type, details),
      area: normaliseGeoPhotoArea(area),
      linkedPermitId: linkedPermitId || "",
      includeInReport,
      photoDataUrl,
      capturedBy: capturedBy.trim(),
      timestampUtc: new Date().toISOString(),
    });

    const duplicate = findRecentDuplicateGeoPhoto(photos, row);
    if (duplicate) {
      const minutes = Math.max(1, Math.round(duplicate.ageMs / 60000));
      const ok = window.confirm(
        `A ${geoPhotoPresetLabel(row.type)} photo was already saved ${duplicate.distanceMeters} m away about ${minutes} minute${
          minutes === 1 ? "" : "s"
        } ago. Save this one as well?`
      );
      if (!ok) return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await persistRow(row, takeAnother);
    } catch (err) {
      const message = err?.message || "Photo could not be saved. Your draft is still here — try again.";
      setSaveError(message);
      pushToast({ type: "error", title: "Photo not saved", message });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const persistRow = async (row, takeAnother) => {
    const scope = captureScopeRef.current;
    if (row.photoDataUrl) {
      try {
        const uploaded = await uploadGeoPhotoToR2(row.photoDataUrl, { projectId, photoId: row.id });
        if (uploaded?.photoStorageKey || uploaded?.photoSignedUrl || uploaded?.photoPublicUrl) {
          row.photoStorageKey = uploaded.photoStorageKey || "";
          row.photoPublicUrl = uploaded.photoPublicUrl || null;
          row.photoSignedUrl = uploaded.photoSignedUrl || null;
          row.photoSignedExpiresAt = uploaded.photoSignedExpiresAt || null;
          if (uploaded.photoStorageKey && uploaded.photoOfflineCached) {
            row.photoDataUrl = "";
          }
        }
      } catch {
        pushToast({
          type: "warn",
          message: "Photo cloud upload failed — saved locally with embedded image.",
        });
      }
    }
    if (scope !== countryOperationalStorageKey(CAPTURE_DRAFT_KEY) || !wasOpenRef.current || row.id !== captureIdRef.current) {
      throw new Error("Workspace changed during upload. The photo draft remains in the original workspace.");
    }
    try {
      localStorage.setItem(LAST_PRESET_KEY, type);
    } catch {
      /* ignore */
    }
    const saved = await onSave(row, { takeAnother });
    if (saved === false) {
      // Keep the draft (and the photo) so a blocked save never loses field work.
      const blockedMsg = "Photo could not be saved. Check the selected project and available storage, then try again. Your draft is still here.";
      setSaveError(blockedMsg);
      pushToast({ type: "error", title: "Photo not saved", message: blockedMsg });
      setStep("details");
      return;
    }
    pushToast({ type: "success", title: "Photo saved", message: "Geo-photo added to your library." });
    await clearCaptureDraft(scope);
    if (scope !== countryOperationalStorageKey(CAPTURE_DRAFT_KEY) || !wasOpenRef.current || row.id !== captureIdRef.current) return;
    captureIdRef.current = newGeoPhotoId();
    if (takeAnother) {
      setStep("photo");
      setPhotoDataUrl("");
      setPhotoName("");
      setPhotoError("");
      setNotes("");
      setLocationId("");
      setDepthM("");
      setSampleRef("");
      setDetails({});
      setArea(null);
      acquireGps();
    } else {
      onClose();
    }
  };

  if (!open) return null;

  const stepIdx = STEPS.indexOf(step);
  const locationStatus = geoPhotoLocationStatus(locationSource, gpsAccuracyMeters);

  return (
    <div
      className="geo-photo-capture-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="geo-photo-capture-title"
    >
      <div className="geo-photo-capture">
        <div className="geo-photo-modal__head">
          <div>
            <div className="geo-photo-capture__eyebrow">Field capture</div>
            <h2 id="geo-photo-capture-title" className="geo-photo-modal__title">
              Add geo-photo
            </h2>
            <p className="geo-photo-capture__hint">Photo → GPS → direction arrow → type &amp; notes.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            style={{ ...ms.btn, padding: "10px 14px", minHeight: 44, touchAction: "manipulation" }}
          >
            Close
          </button>
        </div>

        {draftWarning ? <p role="alert">{draftWarning}</p> : null}
        {photoDataUrl ? <button type="button" style={{ ...ms.btn, minHeight: 44 }} disabled={saving}
          onClick={() => { void clearCaptureDraft(captureScopeRef.current); reset(); }}>
          Discard draft
        </button> : null}
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
              <>
                <button
                  type="button"
                  className="geo-photo-capture__dropzone"
                  onClick={() => cameraRef.current?.click()}
                  disabled={photoBusy}
                >
                  <span className="geo-photo-capture__dropzone-icon" aria-hidden>
                    📷
                  </span>
                  {photoBusy ? "Reading photo…" : "Take photo"}
                </button>
                <button
                  type="button"
                  className="geo-photo-capture__library-btn"
                  style={ms.btn}
                  onClick={() => libraryRef.current?.click()}
                  disabled={photoBusy}
                >
                  Choose from photo library
                </button>
              </>
            )}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*,.heic,.heif"
              capture="environment"
              style={{ display: "none" }}
              onChange={onPickPhoto}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*,.heic,.heif"
              style={{ display: "none" }}
              onChange={onPickPhoto}
            />
            {photoError ? (
              <p className="geo-photo-capture__hint geo-photo-capture__hint--warn" role="alert">{photoError}</p>
            ) : !photoDataUrl ? (
              <p className="geo-photo-capture__hint">
                If camera access is blocked, allow camera or photo access for your browser in device settings, or choose a photo from your library.
              </p>
            ) : null}
            {photoDataUrl ? (
              <div className="geo-photo-capture__actions">
                <button type="button" style={ms.btn} onClick={() => cameraRef.current?.click()} disabled={photoBusy}>
                  Retake
                </button>
                <button type="button" style={ms.btn} onClick={() => libraryRef.current?.click()} disabled={photoBusy}>
                  Choose from library
                </button>
                <button type="button" style={ms.btnP} onClick={() => setStep("location")} disabled={photoBusy}>
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
                onLocationChange={(lat, lng) => {
                  locationRequestRef.current += 1;
                  setGpsBusy(false);
                  setGpsWaiting(false);
                  setLatitude(lat);
                  setLongitude(lng);
                  setGpsAccuracyMeters(null);
                  setAltitudeMeters(null);
                  setLocationSource("manual_pin");
                  setGpsError("");
                }}
              />
            </div>
            <p className="geo-photo-capture__hint">
              Tap the map to drop a pin if GPS is off. Compass arrow shows photo direction.
            </p>
            <p
              className={`geo-photo-capture__hint${locationStatus.tone === "warn" ? " geo-photo-capture__hint--warn" : locationStatus.tone === "ok" ? " geo-photo-capture__hint--ok" : ""}`}
              aria-live="polite"
            >
              <strong>{locationStatus.label}</strong>
              {latitude != null && longitude != null ? (
                <>
                  <br />
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  {nationalGrid ? ` · ${nationalGrid.gridRef}` : ""}
                </>
              ) : null}
            </p>
            {isCoarseGpsAccuracy(gpsAccuracyMeters) ? (
              <p className="geo-photo-capture__hint geo-photo-capture__hint--warn">
                Approximate location — anything over ±{GPS_GOOD_ACCURACY_M} m is too coarse for survey evidence. Wait
                for a better fix, or tap the map to place the pin yourself.
              </p>
            ) : null}
            {gpsError ? <p className="geo-photo-capture__hint geo-photo-capture__hint--warn" role="alert">{gpsError}</p> : null}
            <div className="geo-photo-capture__actions">
              <button type="button" style={ms.btn} onClick={acquireGps} disabled={gpsBusy || gpsWaiting}>
                {gpsBusy ? "Getting GPS…" : "Refresh GPS"}
              </button>
              {isCoarseGpsAccuracy(gpsAccuracyMeters) || latitude == null ? (
                <button type="button" style={ms.btn} onClick={waitForBetterGps} disabled={gpsBusy || gpsWaiting}>
                  {gpsWaiting ? "Waiting for better fix…" : "Wait for better GPS"}
                </button>
              ) : null}
              {exifLocation && locationSource !== "photo_exif" ? (
                <button type="button" style={ms.btn} onClick={useExifLocation} disabled={gpsWaiting}>
                  Use photo location
                </button>
              ) : null}
              <button type="button" style={ms.btn} onClick={() => setStep("photo")}>
                Back
              </button>
              <button
                type="button"
                style={ms.btnP}
                disabled={latitude == null || longitude == null}
                onClick={() => {
                  locationRequestRef.current += 1;
                  setGpsBusy(false);
                  setGpsWaiting(false);
                  setStep("details");
                }}
              >
                Next — details
              </button>
              {latitude == null || longitude == null ? (
                <button type="button" style={ms.btn} onClick={() => {
                  locationRequestRef.current += 1;
                  setGpsBusy(false);
                  setGpsWaiting(false);
                  setStep("details");
                }}>
                  Continue without GPS
                </button>
              ) : null}
            </div>
            {latitude == null || longitude == null ? (
              <p className="geo-photo-capture__hint">You can save the photo without GPS. It will be marked as unlocated and excluded from map exports until you add a position.</p>
            ) : null}

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
                {compassNeedsUserGesture() && compassBearing == null ? (
                  <button type="button" style={ms.btnP} onClick={enableCompass}>
                    Enable compass (iOS)
                  </button>
                ) : null}
                <button
                  type="button"
                  style={ms.btn}
                  onClick={() => setManualBearing(flipBearing180(effectiveBearing ?? 0))}
                >
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

            {linkedPermitId ? (
              <p className="geo-photo-capture__hint geo-photo-capture__hint--ok">
                Linked to permit — will attach as site evidence on save.
              </p>
            ) : null}
            {autoProjectHint ? (
              <p className="geo-photo-capture__hint geo-photo-capture__hint--ok">{autoProjectHint}</p>
            ) : null}
            {saveError ? <p className="geo-photo-capture__hint geo-photo-capture__hint--warn">{saveError}</p> : null}
            <label className="geo-photos-toolbar__field">
              Project
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setSaveError("");
                }}
                style={ms.inp}
              >
                <option value="">— No project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{projectDisplayLabel(p)}</option>
                ))}
              </select>
            </label>
            {onCreateProject ? (
              <div style={{ marginBottom: 12 }}>
                {quickOpen ? (
                  <div className="geo-photo-capture__panel">
                    <div className="geo-photo-capture__panel-title">Quick project</div>
                    <label className="geo-photos-toolbar__field">
                      Site / project name
                      <input
                        value={quickName}
                        onChange={(e) => {
                          setQuickName(e.target.value);
                          setQuickError("");
                        }}
                        placeholder="Elm Road footway"
                        autoFocus
                        style={ms.inp}
                      />
                    </label>
                    <label className="geo-photos-toolbar__field">
                      Address (optional)
                      <input
                        value={quickAddress}
                        onChange={(e) => setQuickAddress(e.target.value)}
                        placeholder="12 Elm Road, Leeds LS1 1BA"
                        style={ms.inp}
                      />
                    </label>
                    <p className="geo-photo-capture__hint">
                      Name is enough on site
                      {latitude != null && longitude != null ? " — current GPS is saved as the site location" : ""}. Add
                      client, dates and risks back in the office.
                    </p>
                    {quickError ? (
                      <p className="geo-photo-capture__hint geo-photo-capture__hint--warn">{quickError}</p>
                    ) : null}
                    <div className="geo-photo-capture__actions">
                      <button type="button" style={ms.btnP} onClick={submitQuickProject}>
                        Create &amp; link
                      </button>
                      <button
                        type="button"
                        style={ms.btn}
                        onClick={() => {
                          setQuickOpen(false);
                          setQuickError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    style={{ ...ms.btn, minHeight: 44, touchAction: "manipulation" }}
                    onClick={() => {
                      setQuickOpen(true);
                      setQuickError("");
                    }}
                  >
                    + Quick project (name only)
                  </button>
                )}
              </div>
            ) : null}
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
            {showGiFields ? (
              <div className="geo-photo-capture__panel" style={{ marginBottom: 12 }}>
                <div className="geo-photo-capture__panel-title">Ground investigation fields</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                  <label className="geo-photos-toolbar__field">
                    Location ID
                    <input
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      placeholder="BH01"
                      style={ms.inp}
                    />
                  </label>
                  <label className="geo-photos-toolbar__field">
                    Depth (m bgl)
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={depthM}
                      onChange={(e) => setDepthM(e.target.value)}
                      placeholder="12.5"
                      style={ms.inp}
                    />
                  </label>
                  <label className="geo-photos-toolbar__field">
                    Sample ref
                    <input
                      value={sampleRef}
                      onChange={(e) => setSampleRef(e.target.value)}
                      placeholder="S-042"
                      style={ms.inp}
                    />
                  </label>
                  <label className="geo-photos-toolbar__field">
                    Phase
                    <select value={capturePhase} onChange={(e) => setCapturePhase(e.target.value)} style={ms.inp}>
                      {CAPTURE_PHASE_OPTIONS.map((p) => (
                        <option key={p.key || "none"} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
            <GeoPhotoTypeFieldInputs type={type} value={details} onChange={setDetails} />
            <GeoPhotoAreaPanel
              type={type}
              latitude={latitude}
              longitude={longitude}
              color={preset.color}
              value={area}
              onChange={setArea}
            />
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
            <label
              className={`geo-photos-card__report ${includeInReport ? "geo-photos-card__report--on" : ""}`}
              style={{ marginBottom: 16 }}
            >
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
