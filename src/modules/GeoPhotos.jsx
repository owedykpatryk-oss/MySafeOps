import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { pushRecycleBinItem, softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import PageHero from "../components/PageHero";
import { openHelpGuide } from "../utils/workspaceNavContext";
import EmptyState from "../components/EmptyState";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import GeoPhotosMap from "../components/geoPhotos/GeoPhotosMap";
import GeoPhotoCaptureModal from "../components/geoPhotos/GeoPhotoCaptureModal";
import GeoPhotoDirectionMap from "../components/geoPhotos/GeoPhotoDirectionMap";
import GeoPhotoImg from "../components/geoPhotos/GeoPhotoImg";
import { geoPhotoPreset, geoPhotoPresetLabel, listGeoPhotoPresetsForOrg } from "../utils/geoPhotoPresets";
import { isUtilityMappingOrg } from "../utils/utilityMappingOrg";
import { consumeWorkspaceNavTarget, openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { ensureProjectLinked } from "../utils/projectRequiredGate";
import { buildQuickProject, findProjectByName } from "../utils/quickProject";
import { billingLimitMessage, checkBillingLimit } from "../utils/billingLimits";
import { useToast } from "../context/ToastContext";
import { isSurveyWorkflowEnabled } from "../utils/projectHubIndustry";
import { buildGeoPhotoMobilisationChecklist, geoPhotoGroupCoverage } from "../utils/geoPhotoMobilisation";
import { useRegisterPdfExportOverride } from "../context/RegisterPdfExportContext";
import { stripGeoPhotosForD1 } from "../utils/d1SyncPayload";
import { geoPhotoHasRenderableMedia, preserveGeoPhotoMedia, uploadGeoPhotoToR2 } from "../utils/geoPhotoMedia";
import { isCoarseGpsAccuracy } from "../utils/geoPhotoUtils";
import { wgs84ToBritishNationalGrid } from "../utils/britishNationalGrid";
import {
  downloadGeoJson,
  nextGeoPhotoReportOrder,
  normalizeGeoPhotoReportOrders,
  projectGeoPhotosForReport,
  reorderGeoPhotoReport,
  snagDraftFromGeoPhoto,
  persistPermitEvidenceFromGeoPhoto,
  clearPermitEvidenceForGeoPhoto,
} from "../utils/geoPhotoIntegrations";
import {
  downloadGeoPhotosKml,
  downloadGeoPhotosKmz,
  downloadGeoPhotosDxf,
  downloadGeoPhotosCadBundle,
  downloadGeoPhotosGpx,
  filterGeoPhotosWithCoords,
  prepareGeoPhotoExport,
} from "../utils/geoPhotoExport";
import {
  isGiGeoPhotoType,
  buildStructuredGeoPhotoNotes,
  stripStructuredGeoPhotoNotes,
  CAPTURE_PHASE_OPTIONS,
} from "../utils/geoPhotoFields";
import GeoPhotoTypeFieldInputs from "../components/geoPhotos/GeoPhotoTypeFieldInputs";
import { authorshipAuditFields } from "../utils/documentAuthorship";
import {
  geoPhotoActionOutstanding,
  geoPhotoActionResolved,
  geoPhotoActionSeverity,
  geoPhotoRaisesAction,
  outstandingGeoPhotoActions,
  setGeoPhotoActionResolved,
} from "../utils/geoPhotoActions";
import {
  geoPhotoDetailSummary,
  normaliseGeoPhotoDetails,
} from "../utils/geoPhotoTypeFields";

import { todayLocalISO } from "../utils/localDate";
const STORAGE_KEY = "geo_photos";
const LIST_PAGE = 48;

function asPhotoArray(value) {
  return Array.isArray(value) ? value : [];
}

function GeoPhotoMobilisationPanel({ checklist, groupCoverage, onCapture, onPushSurvey }) {
  if (!checklist) return null;
  return (
    <div className="geo-photos-mobilisation">
      <div className="geo-photos-mobilisation__head">
        <h3 className="geo-photos-mobilisation__title">Mobilisation checklist</h3>
        <span className="geo-photos-mobilisation__score">{checklist.pct}%</span>
      </div>
      <p className="geo-photos-mobilisation__lead">
        Field coverage before survey issue — {checklist.doneCount}/{checklist.total} complete.
      </p>
      <ul className="geo-photos-mobilisation__list">
        {checklist.checks.map((item) => (
          <li
            key={item.id}
            className={`geo-photos-mobilisation__row ${item.done ? "geo-photos-mobilisation__row--done" : ""}`}
          >
            <span className="geo-photos-mobilisation__tick" aria-hidden>
              {item.done ? "✓" : "○"}
            </span>
            <span className="geo-photos-mobilisation__label">{item.label}</span>
            {item.id === "report_pack" && item.target != null ? (
              <span className="geo-photos-mobilisation__meta">
                {item.count ?? 0}/{item.target}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {groupCoverage.length > 0 ? (
        <div className="geo-photos-mobilisation__groups">
          {groupCoverage.map(({ group, count }) => (
            <span key={group} className="geo-photos-mobilisation__group-pill">
              {group} · {count}
            </span>
          ))}
        </div>
      ) : null}
      <div className="geo-photo-capture__actions" style={{ marginTop: 12 }}>
        <button type="button" style={{ ...ms.btnP, fontSize: 12, padding: "6px 12px" }} onClick={onCapture}>
          + Capture geo-photo
        </button>
        {checklist.reportCount > 0 ? (
          <button type="button" style={{ ...ms.btn, fontSize: 12, padding: "6px 12px" }} onClick={onPushSurvey}>
            Push to survey
          </button>
        ) : null}
      </div>
    </div>
  );
}

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function exportCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "id",
    "project",
    "type",
    "latitude",
    "longitude",
    "bearing",
    "includeInReport",
    "locationId",
    "depthM",
    "linkedPermitId",
    "observations",
    "notes",
    "capturedBy",
    "timestampUtc",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.projectName || r.projectId,
        geoPhotoPresetLabel(r.type),
        r.latitude,
        r.longitude,
        r.bearing,
        r.includeInReport ? "yes" : "no",
        r.locationId || "",
        r.depthM ?? "",
        r.linkedPermitId || "",
        geoPhotoDetailSummary(r),
        r.notes,
        r.capturedBy,
        r.timestampUtc,
      ]
        .map(esc)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geo-photos-${todayLocalISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** The prose the user typed, without the structured tokens merged into `notes` at save. */
function baseNotesOf(photo) {
  return stripStructuredGeoPhotoNotes(photo?.notes, {
    locationId: photo?.locationId,
    depthM: photo?.depthM,
    sampleRef: photo?.sampleRef,
    capturePhase: photo?.capturePhase,
  });
}

function GeoPhotoDetail({
  photo,
  onClose,
  onUpdate,
  onDelete,
  onCreateSnag,
  onOpenSurvey,
  onOpenPermit,
  onResolveAction,
}) {
  const preset = geoPhotoPreset(photo.type);
  const showGi = isGiGeoPhotoType(photo.type);
  const [notes, setNotes] = useState(() => baseNotesOf(photo));
  const [includeInReport, setIncludeInReport] = useState(!!photo.includeInReport);
  const [bearing, setBearing] = useState(photo.bearing);
  const [locationId, setLocationId] = useState(photo.locationId || "");
  const [depthM, setDepthM] = useState(photo.depthM ?? "");
  const [sampleRef, setSampleRef] = useState(photo.sampleRef || "");
  const [capturePhase, setCapturePhase] = useState(photo.capturePhase || "");
  const [details, setDetails] = useState(() => photo.details || {});
  const nationalGrid = useMemo(
    () => wgs84ToBritishNationalGrid(photo.latitude, photo.longitude),
    [photo.latitude, photo.longitude]
  );

  useEffect(() => {
    setNotes(baseNotesOf(photo));
    setIncludeInReport(!!photo.includeInReport);
    setBearing(photo.bearing);
    setLocationId(photo.locationId || "");
    setDepthM(photo.depthM ?? "");
    setSampleRef(photo.sampleRef || "");
    setCapturePhase(photo.capturePhase || "");
    setDetails(photo.details || {});
  }, [photo]);

  return (
    <div className="geo-photo-modal-backdrop" role="dialog" aria-modal="true">
      <div className="geo-photo-modal">
        <div className="geo-photo-modal__head">
          <h3 className="geo-photo-modal__title">
            {preset.icon} {preset.label}
          </h3>
          <button type="button" style={ms.btn} onClick={onClose}>
            Close
          </button>
        </div>
        <GeoPhotoImg photo={photo} className="geo-photo-modal__preview" />
        <div className="geo-photos-card__map" style={{ marginBottom: 12 }}>
          <GeoPhotoDirectionMap
            latitude={photo.latitude}
            longitude={photo.longitude}
            accuracyMeters={photo.gpsAccuracyMeters}
            bearing={bearing}
            arrowColor={preset.color}
            height={160}
            interactive
          />
        </div>
        <p className="geo-photos-card__meta" style={{ margin: "0 0 12px" }}>
          {photo.projectName || "No project"} · {fmtWhen(photo.timestampUtc)}
          {photo.capturedBy ? ` · ${photo.capturedBy}` : ""}
          {photo.gpsAccuracyMeters != null ? ` · ±${Math.round(Number(photo.gpsAccuracyMeters))} m` : ""}
          {isCoarseGpsAccuracy(photo.gpsAccuracyMeters) ? " (approximate)" : ""}
          {nationalGrid ? ` · ${nationalGrid.gridRef}` : ""}
          {photo.locationSource === "photo_exif" ? " · location from photo metadata" : ""}
          {photo.locationSource === "manual_pin" ? " · pin placed by hand" : ""}
          {photo.locationSource === "project_site" ? " · project site coordinates" : ""}
        </p>
        {photo.linkedPermitId ? (
          <p className="geo-photos-card__meta" style={{ margin: "0 0 12px" }}>
            Linked permit:{" "}
            {onOpenPermit ? (
              <button type="button" style={{ ...ms.btn, padding: "10px 12px", minHeight: 44, fontSize: 13, touchAction: "manipulation" }} onClick={() => onOpenPermit(photo.linkedPermitId)}>
                {photo.linkedPermitId}
              </button>
            ) : (
              photo.linkedPermitId
            )}
          </p>
        ) : null}
        {showGi ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10, marginBottom: 12 }}>
            <label className="geo-photos-toolbar__field">
              Location ID
              <input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="BH01, TP02…" style={ms.inp} />
            </label>
            <label className="geo-photos-toolbar__field">
              Depth (m)
              <input
                type="number"
                min={0}
                step="0.1"
                value={depthM}
                onChange={(e) => setDepthM(e.target.value)}
                placeholder="e.g. 12"
                style={ms.inp}
              />
            </label>
            <label className="geo-photos-toolbar__field">
              Sample ref
              <input value={sampleRef} onChange={(e) => setSampleRef(e.target.value)} placeholder="S-001" style={ms.inp} />
            </label>
            <label className="geo-photos-toolbar__field">
              Phase
              <select value={capturePhase} onChange={(e) => setCapturePhase(e.target.value)} style={ms.inp}>
                {CAPTURE_PHASE_OPTIONS.map((o) => (
                  <option key={o.key || "none"} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <GeoPhotoTypeFieldInputs type={photo.type} value={details} onChange={setDetails} showPrompt={false} />
        <label className="geo-photos-toolbar__field" style={{ marginBottom: 12 }}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...ms.inp, resize: "vertical" }}
          />
        </label>
        <label
          className={`geo-photos-card__report ${includeInReport ? "geo-photos-card__report--on" : ""}`}
          style={{ marginBottom: 12 }}
        >
          <input type="checkbox" checked={includeInReport} onChange={(e) => setIncludeInReport(e.target.checked)} />
          Include in report
        </label>
        <label className="geo-photos-toolbar__field" style={{ marginBottom: 16 }}>
          Bearing °
          <input
            type="number"
            min={0}
            max={359}
            value={bearing ?? ""}
            onChange={(e) => setBearing(e.target.value === "" ? null : Number(e.target.value))}
            style={{ ...ms.inp, width: 120 }}
          />
        </label>
        <div className="geo-photo-capture__actions">
          <button
            type="button"
            style={ms.btnP}
            onClick={() => {
              const depthVal = depthM === "" ? null : Number(depthM);
              const mergedNotes = showGi
                ? buildStructuredGeoPhotoNotes({
                    notes: notes.trim(),
                    locationId: locationId.trim(),
                    depthM: Number.isFinite(depthVal) ? depthVal : null,
                    sampleRef: sampleRef.trim(),
                    capturePhase,
                  })
                : notes.trim();
              onUpdate({
                ...photo,
                notes: mergedNotes,
                locationId: locationId.trim(),
                depthM: Number.isFinite(depthVal) ? depthVal : null,
                sampleRef: sampleRef.trim(),
                capturePhase,
                details: normaliseGeoPhotoDetails(photo.type, details),
                includeInReport,
                bearing,
                updatedAt: new Date().toISOString(),
              });
            }}
          >
            Save changes
          </button>
          {photo.projectId && onOpenSurvey ? (
            <button type="button" style={ms.btn} onClick={() => onOpenSurvey(photo.projectId)}>
              Open survey report
            </button>
          ) : null}
          {geoPhotoRaisesAction(photo) && onResolveAction ? (
            <button
              type="button"
              style={geoPhotoActionResolved(photo) ? ms.btn : ms.btnP}
              onClick={() => onResolveAction(photo.id, !geoPhotoActionResolved(photo))}
            >
              {geoPhotoActionResolved(photo) ? "Reopen action" : "Mark action done"}
            </button>
          ) : null}
          {onCreateSnag ? (
            <button type="button" style={ms.btn} onClick={() => onCreateSnag(photo)}>
              Create snag
            </button>
          ) : null}
          <button type="button" style={ms.btnDanger} onClick={() => onDelete(photo.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GeoPhotos() {
  const { orgName, trialStatus, billing, isPlatformOwner } = useApp();
  const { pushToast } = useToast();
  const pendingGeoPhotoIdRef = useRef(null);
  const [photos, setPhotos] = useState(() => asPhotoArray(load(STORAGE_KEY, [])));
  const [workers, setWorkers] = useState(() => asPhotoArray(load("mysafeops_workers", [])));
  const [projects, setProjects] = useState(() => asPhotoArray(load("mysafeops_projects", [])));
  const [filterProject, setFilterProject] = useState("");
  const [filterReport, setFilterReport] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterType, setFilterType] = useState("");
  const [query, setQuery] = useState("");
  const [satellite, setSatellite] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturePreset, setCapturePreset] = useState("");
  const [captureLinkedPermitId, setCaptureLinkedPermitId] = useState("");
  const [exportBusy, setExportBusy] = useState("");
  const [detail, setDetail] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const photoPresets = useMemo(() => listGeoPhotoPresetsForOrg(isUtilityMappingOrg()), [orgName]);

  // Stable identities — inline closures re-triggered D1 hydration on every render (flicker + refetch loop).
  const loadArray = useCallback((key, fallback) => asPhotoArray(load(key, fallback)), []);
  const setPhotosFromSync = useCallback((next) => {
    setPhotos((prev) => preserveGeoPhotoMedia(asPhotoArray(prev), asPhotoArray(next)));
  }, []);
  const setWorkersFromSync = useCallback((next) => setWorkers(asPhotoArray(next)), []);
  const setProjectsFromSync = useCallback((next) => setProjects(asPhotoArray(next)), []);

  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: STORAGE_KEY,
    namespace: "geo_photos",
    value: photos,
    setValue: setPhotosFromSync,
    load: loadArray,
    save,
    serializeForSync: stripGeoPhotosForD1,
  });

  useD1WorkersProjectsSync({
    workers,
    setWorkers: setWorkersFromSync,
    projects,
    setProjects: setProjectsFromSync,
    load: loadArray,
    save,
  });

  useEffect(() => {
    const nav = consumeWorkspaceNavTarget();
    if (nav?.viewId !== "geo-photos") return;
    if (nav.projectId) setFilterProject(nav.projectId);
    if (nav.geoPhotoPreset) setCapturePreset(nav.geoPhotoPreset);
    if (nav.permitId) setCaptureLinkedPermitId(nav.permitId);
    if (nav.action === "capture") setCaptureOpen(true);
    if (nav.geoPhotoId) pendingGeoPhotoIdRef.current = nav.geoPhotoId;
  }, []);

  useEffect(() => {
    const targetId = pendingGeoPhotoIdRef.current;
    if (!targetId) return;
    const photo = photos.find((p) => p.id === targetId);
    if (photo) {
      setDetail(photo);
      if (photo.projectId) setFilterProject(photo.projectId);
      pendingGeoPhotoIdRef.current = null;
    }
  }, [photos]);

  const safePhotos = useMemo(() => liveOrgArrayRows(asPhotoArray(photos)), [photos]);
  const activeProjects = useMemo(() => asPhotoArray(projects).filter((p) => !p.closed), [projects]);
  const selectedProject = useMemo(
    () => activeProjects.find((p) => p.id === filterProject) || null,
    [activeProjects, filterProject]
  );
  const surveyPack = isSurveyWorkflowEnabled();

  const hasActiveFilters = Boolean(
    filterProject || filterReport !== "all" || filterAction !== "all" || filterType || query.trim()
  );

  const clearFilters = () => {
    setFilterProject("");
    setFilterReport("all");
    setFilterAction("all");
    setFilterType("");
    setQuery("");
  };

  const openActions = useMemo(() => outstandingGeoPhotoActions(safePhotos, filterProject), [safePhotos, filterProject]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safePhotos
      .filter((p) => {
        if (filterProject && p.projectId !== filterProject) return false;
        if (filterReport === "report" && !p.includeInReport) return false;
        if (filterReport === "exclude" && p.includeInReport) return false;
        if (filterAction === "open" && !geoPhotoActionOutstanding(p)) return false;
        if (filterAction === "raised" && !geoPhotoRaisesAction(p)) return false;
        if (filterType && p.type !== filterType) return false;
        if (!q) return true;
        const hay = [
          p.notes,
          p.projectName,
          geoPhotoPresetLabel(p.type),
          p.capturedBy,
          p.locationId,
          p.sampleRef,
          geoPhotoDetailSummary(p),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) => new Date(b.timestampUtc || b.createdAt).getTime() - new Date(a.timestampUtc || a.createdAt).getTime()
      );
  }, [safePhotos, filterProject, filterReport, filterAction, filterType, query]);

  const exportGpsStats = useMemo(() => filterGeoPhotosWithCoords(filtered), [filtered]);

  const pdfExportNote = hasActiveFilters ? `Filtered view · ${filtered.length} photo(s)` : null;
  useRegisterPdfExportOverride("geo-photos", filtered, pdfExportNote);

  const reportPack = useMemo(
    () => (filterProject ? projectGeoPhotosForReport(safePhotos, filterProject) : []),
    [safePhotos, filterProject]
  );

  const mobilisation = useMemo(
    () =>
      filterProject
        ? buildGeoPhotoMobilisationChecklist(safePhotos, filterProject, {
            surveyPack,
            giPack: selectedProject?.playbookId === "site_investigation",
          })
        : null,
    [filterProject, safePhotos, surveyPack, selectedProject?.playbookId]
  );

  const groupCoverage = useMemo(
    () => (filterProject ? geoPhotoGroupCoverage(safePhotos, filterProject) : []),
    [safePhotos, filterProject]
  );

  const listPg = useRegisterListPaging(LIST_PAGE);

  useEffect(() => {
    listPg.reset();
  }, [filterProject, filterReport, filterAction, filterType, query]);

  const reportCount = useMemo(() => filtered.filter((p) => p.includeInReport).length, [filtered]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetReport = (include) => {
    if (selectedIds.size === 0) return;
    const now = new Date().toISOString();
    setPhotos((prev) => {
      const list = asPhotoArray(prev);
      const nextOrderByProject = {};
      const takeOrder = (projectId) => {
        if (!nextOrderByProject[projectId]) {
          nextOrderByProject[projectId] = nextGeoPhotoReportOrder(list, projectId);
        }
        const order = nextOrderByProject[projectId];
        nextOrderByProject[projectId] = order + 1;
        return order;
      };
      return list.map((p) => {
        if (!selectedIds.has(p.id)) return p;
        if (!include) {
          return { ...p, includeInReport: false, reportOrder: null, updatedAt: now };
        }
        return {
          ...p,
          includeInReport: true,
          reportOrder: p.projectId ? takeOrder(p.projectId) : p.reportOrder,
          updatedAt: now,
        };
      });
    });
    setSelectedIds(new Set());
  };

  /**
   * Photos captured while the R2 upload was failing exist only as base64 in localStorage —
   * one quota error and they are gone. Move them to R2 in small batches once hydration settles.
   */
  const backfillBusyRef = useRef(false);
  useEffect(() => {
    if (d1Hydrating || backfillBusyRef.current) return;
    const orphans = safePhotos.filter((p) => p.photoDataUrl && !p.photoStorageKey).slice(0, 5);
    if (!orphans.length) return;

    backfillBusyRef.current = true;
    let cancelled = false;
    (async () => {
      for (const photo of orphans) {
        if (cancelled) break;
        let uploaded;
        try {
          uploaded = await uploadGeoPhotoToR2(photo.photoDataUrl, {
            projectId: photo.projectId,
            photoId: photo.id,
          });
        } catch {
          break; // offline or auth problem — try again on the next visit
        }
        if (!uploaded?.photoStorageKey) break; // storage not configured for this org
        if (cancelled) break;
        setPhotos((prev) =>
          asPhotoArray(prev).map((p) =>
            p.id === photo.id
              ? {
                  ...p,
                  photoStorageKey: uploaded.photoStorageKey,
                  photoPublicUrl: uploaded.photoPublicUrl || null,
                  photoSignedUrl: uploaded.photoSignedUrl || null,
                  photoSignedExpiresAt: uploaded.photoSignedExpiresAt || null,
                  photoDataUrl: "",
                  updatedAt: new Date().toISOString(),
                }
              : p
          )
        );
      }
      backfillBusyRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [d1Hydrating, safePhotos]);

  /** Field users can start a site with just a name; the office completes it later in Projects. */
  const handleQuickProject = useCallback(
    ({ name, address = "", latitude = null, longitude = null }) => {
      const existing = findProjectByName(name, activeProjects);
      if (existing) return existing;

      const gate = checkBillingLimit("projects", { trialStatus, billing, isPlatformOwner });
      if (!gate.ok) {
        pushToast({ type: "warn", message: billingLimitMessage(gate) });
        return null;
      }
      const project = buildQuickProject({ name, address, latitude, longitude });
      if (!project) return null;

      setProjects((prev) => [project, ...asPhotoArray(prev)]);
      pushAudit({
        action: "project_quick_create",
        detail: `${project.name} — created from geo-photo capture`,
        module: "geo-photos",
      });
      pushToast({ type: "success", message: `Project "${project.name}" created — add details in Projects later.` });
      return project;
    },
    [activeProjects, trialStatus, billing, isPlatformOwner, pushToast]
  );

  const handleSaveNew = useCallback(
    (row) => {
      if (
        !ensureProjectLinked({
          projectId: row.projectId,
          projects: activeProjects,
          moduleLabel: "geo-photo",
          allowInlineCreate: true,
        })
      )
        return false;
      const enriched = { ...row };
      if (enriched.includeInReport && enriched.projectId) {
        enriched.reportOrder = nextGeoPhotoReportOrder(safePhotos, enriched.projectId);
      }
      setPhotos((prev) => {
        const list = asPhotoArray(prev);
        // Same capture saved twice (retry, restored draft) updates its row rather than adding a copy.
        return list.some((p) => p?.id === enriched.id)
          ? list.map((p) => (p?.id === enriched.id ? { ...p, ...enriched } : p))
          : [enriched, ...list];
      });
      if (enriched.linkedPermitId) {
        persistPermitEvidenceFromGeoPhoto(enriched, { load, save });
      }
      pushAudit({
        action: "geo_photo_create",
        detail: `${geoPhotoPresetLabel(enriched.type)} — ${enriched.projectName || "no project"}`,
        module: "geo-photos",
      });
      return true;
    },
    [safePhotos, activeProjects]
  );

  const handleUpdate = (row) => {
    setPhotos((prev) => asPhotoArray(prev).map((p) => (p.id === row.id ? row : p)));
    if (row.linkedPermitId) {
      persistPermitEvidenceFromGeoPhoto(row, { load, save });
    }
    setDetail(null);
    pushAudit({ action: "geo_photo_update", detail: row.id, module: "geo-photos" });
  };

  const handleResolveAction = useCallback((id, resolved) => {
    const by = authorshipAuditFields().by || "";
    setPhotos((prev) => asPhotoArray(prev).map((p) => (p.id === id ? setGeoPhotoActionResolved(p, resolved, { by }) : p)));
    setDetail((d) => (d?.id === id ? setGeoPhotoActionResolved(d, resolved, { by }) : d));
    pushAudit({
      action: resolved ? "geo_photo_action_resolved" : "geo_photo_action_reopened",
      detail: id,
      module: "geo-photos",
    });
  }, []);

  const handleDelete = (id) => {
    const victim = safePhotos.find((p) => p.id === id);
    if (!victim) return;
    if (
      !softDeleteToRecycleBin({
        confirmMessage: "Delete this geo-photo? It moves to Recycle Bin for 7 days.",
        moduleId: "geo-photos",
        moduleLabel: "Geo-photos",
        itemType: "geo_photo",
        itemLabel: geoPhotoPresetLabel(victim.type),
        sourceKey: STORAGE_KEY,
        payload: victim,
      })
    ) {
      return;
    }
    clearPermitEvidenceForGeoPhoto(victim, { load, save });
    setPhotos((prev) => replaceWithTombstone(asPhotoArray(prev), id));
    setDetail(null);
    pushAudit({ action: "geo_photo_delete", detail: id, module: "geo-photos" });
  };

  const handleBulkDelete = () => {
    const victims = safePhotos.filter((p) => selectedIds.has(p.id));
    if (!victims.length) return;
    const count = victims.length;
    if (
      !window.confirm(
        `Delete ${count} geo-photo${count === 1 ? "" : "s"}? They move to Recycle Bin for 7 days.`
      )
    ) {
      return;
    }
    for (const victim of victims) {
      pushRecycleBinItem({
        moduleId: "geo-photos",
        moduleLabel: "Geo-photos",
        itemType: "geo_photo",
        itemLabel: geoPhotoPresetLabel(victim.type),
        sourceKey: STORAGE_KEY,
        payload: victim,
      });
      clearPermitEvidenceForGeoPhoto(victim, { load, save });
    }
    setPhotos((prev) => victims.reduce((acc, v) => replaceWithTombstone(acc, v.id), asPhotoArray(prev)));
    setSelectedIds(new Set());
    setDetail(null);
    pushAudit({ action: "geo_photo_bulk_delete", detail: `${count} photo(s)`, module: "geo-photos" });
    pushToast({
      type: "success",
      message: `${count} photo${count === 1 ? "" : "s"} moved to Recycle Bin — restore within 7 days.`,
    });
  };

  const openLinkedPermit = (permitId) => {
    setDetail(null);
    setWorkspaceNavTarget({ viewId: "permits", permitId, action: "edit" });
    openWorkspaceView({ viewId: "permits" });
  };

  const pushToSurvey = (projectId) => {
    if (!projectId) return;
    setWorkspaceNavTarget({ viewId: "survey-report", projectId, action: "editWithGeoPhotos" });
    openWorkspaceView({ viewId: "survey-report" });
  };

  const createSnagFromPhoto = (photo) => {
    const snags = asPhotoArray(load("snags", []));
    const draft = snagDraftFromGeoPhoto(photo);
    const counter = load("snag_counter", 1) || 1;
    draft.ref = `SN-${String(counter).padStart(3, "0")}`;
    save("snag_counter", counter + 1);
    save("snags", [draft, ...snags]);
    pushAudit({ action: "snag_from_geo_photo", detail: draft.ref, module: "geo-photos" });
    setDetail(null);
    setWorkspaceNavTarget({
      viewId: "snags",
      projectId: photo.projectId || "",
      snagId: draft.id,
      action: "view",
    });
    openWorkspaceView({ viewId: "snags" });
  };

  const moveReportPhoto = (photoId, direction) => {
    setPhotos((prev) => reorderGeoPhotoReport(prev, photoId, direction));
  };

  const runExport = async (kind) => {
    if (!filtered.length) return;
    const prepared = prepareGeoPhotoExport(filtered);
    if (!prepared) return;
    const stamp = todayLocalISO();
    const projectName = selectedProject?.name || "";
    const opts = { projectName, name: projectName || "Geo-photos", projectId: filterProject || "" };
    setExportBusy(kind);
    try {
      const photos = prepared.photos;
      if (kind === "kml") downloadGeoPhotosKml(photos, `geo-photos-${stamp}.kml`, opts);
      else if (kind === "kmz") await downloadGeoPhotosKmz(photos, `geo-photos-${stamp}.kmz`, opts);
      else if (kind === "dxf") downloadGeoPhotosDxf(photos, `geo-photos-${stamp}.dxf`, opts);
      else if (kind === "cad") await downloadGeoPhotosCadBundle(photos, `geo-photos-cad-${stamp}.zip`, opts);
      else if (kind === "gpx") downloadGeoPhotosGpx(photos, `geo-photos-${stamp}.gpx`, opts);
    } catch (e) {
      window.alert(e?.message || "Export failed");
    } finally {
      setExportBusy("");
    }
  };

  const syncReportOrder = () => {
    if (!filterProject) return;
    setPhotos((prev) => normalizeGeoPhotoReportOrders(prev, filterProject));
  };

  return (
    <div className="geo-photos-page">
      <PageHero
        badgeText="GP"
        title="Geo-photos"
        lead="Field photos with GPS and direction arrow — export to KML/KMZ (Google Earth), GPX, AutoCAD DXF (camera block + GI attributes) or CAD ZIP with OSM viewer and images."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={ms.btn} onClick={() => openHelpGuide({ guideId: "geo-photos" })}>
              Help
            </button>
            {filterProject ? (
              <button type="button" style={ms.btn} onClick={() => pushToSurvey(filterProject)}>
                Push to survey
              </button>
            ) : null}
            <button
              type="button"
              className="geo-photos-hero-capture"
              style={ms.btnP}
              onClick={() => setCaptureOpen(true)}
            >
              + Add geo-photo
            </button>
          </div>
        }
      />

      <D1ModuleSyncBanner hydrating={d1Hydrating} outboxPending={d1OutboxPending} />

      <div className="geo-photos-toolbar">
        <label className="geo-photos-toolbar__field">
          Project
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} style={ms.inp}>
            <option value="">All projects</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Untitled"}
              </option>
            ))}
          </select>
        </label>
        <label className="geo-photos-toolbar__field">
          Report
          <select value={filterReport} onChange={(e) => setFilterReport(e.target.value)} style={ms.inp}>
            <option value="all">All</option>
            <option value="report">In report only</option>
            <option value="exclude">Excluded</option>
          </select>
        </label>
        <label className="geo-photos-toolbar__field">
          Actions
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={ms.inp}>
            <option value="all">All</option>
            <option value="open">Outstanding only</option>
            <option value="raised">Raised (open or closed)</option>
          </select>
        </label>
        <label className="geo-photos-toolbar__field">
          Type
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={ms.inp}>
            <option value="">All types</option>
            {photoPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="geo-photos-toolbar__field">
          Search
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Notes, type…" style={ms.inp} />
        </label>
        <label className="geo-photos-toolbar__toggle">
          <input type="checkbox" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} />
          Satellite map
        </label>
        <div className="geo-photos-toolbar__actions">
          {hasActiveFilters ? (
            <button type="button" style={ms.btn} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
          <button type="button" style={ms.btn} onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
            Export CSV
          </button>
          <button
            type="button"
            style={ms.btn}
            onClick={() => downloadGeoJson(filtered)}
            disabled={filtered.length === 0}
          >
            GeoJSON
          </button>
          <button type="button" style={ms.btn} onClick={() => runExport("kml")} disabled={exportGpsStats.withCoords.length === 0 || exportBusy}>
            {exportBusy === "kml" ? "KML…" : "KML"}
          </button>
          <button type="button" style={ms.btn} onClick={() => runExport("kmz")} disabled={exportGpsStats.withCoords.length === 0 || exportBusy}>
            {exportBusy === "kmz" ? "KMZ…" : "KMZ + photos"}
          </button>
          <button type="button" style={ms.btn} onClick={() => runExport("gpx")} disabled={exportGpsStats.withCoords.length === 0 || exportBusy}>
            {exportBusy === "gpx" ? "GPX…" : "GPX"}
          </button>
          <button type="button" style={ms.btn} onClick={() => runExport("dxf")} disabled={exportGpsStats.withCoords.length === 0 || exportBusy}>
            {exportBusy === "dxf" ? "DXF…" : "AutoCAD DXF"}
          </button>
          <button type="button" style={ms.btnP} onClick={() => runExport("cad")} disabled={exportGpsStats.withCoords.length === 0 || exportBusy}>
            {exportBusy === "cad" ? "ZIP…" : "CAD pack (ZIP)"}
          </button>
          {exportGpsStats.withoutCoords.length > 0 ? (
            <span className="geo-photos-toolbar__hint" style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {exportGpsStats.withCoords.length} with GPS · {exportGpsStats.withoutCoords.length} skipped in map exports
            </span>
          ) : null}
        </div>
      </div>

      {openActions.length > 0 ? (
        <div className="geo-photos-actions-banner">
          <span className="geo-photos-actions-banner__count">{openActions.length}</span>
          <span className="geo-photos-actions-banner__text">
            outstanding action{openActions.length === 1 ? "" : "s"} raised on site
            {selectedProject?.name ? ` · ${selectedProject.name}` : ""}
            {openActions.some((p) => geoPhotoActionSeverity(p) === "High")
              ? ` · ${openActions.filter((p) => geoPhotoActionSeverity(p) === "High").length} high severity`
              : ""}
          </span>
          {filterAction === "open" ? (
            <button
              type="button"
              style={{ ...ms.btn, fontSize: 12, padding: "6px 14px" }}
              onClick={() => setFilterAction("all")}
            >
              Show all photos
            </button>
          ) : (
            <button
              type="button"
              style={{ ...ms.btnP, fontSize: 12, padding: "6px 14px" }}
              onClick={() => setFilterAction("open")}
            >
              Work through them
            </button>
          )}
        </div>
      ) : null}

      {filterProject && mobilisation ? (
        <GeoPhotoMobilisationPanel
          checklist={mobilisation}
          groupCoverage={groupCoverage}
          onCapture={() => setCaptureOpen(true)}
          onPushSurvey={() => pushToSurvey(filterProject)}
        />
      ) : null}

      {filterProject && reportPack.length > 0 ? (
        <div className="geo-photos-survey-banner">
          <span className="geo-photos-survey-banner__text">
            {reportPack.length} geo-photo{reportPack.length === 1 ? "" : "s"} ready for survey report
            {selectedProject?.name ? ` · ${selectedProject.name}` : ""}
          </span>
          <button
            type="button"
            style={{ ...ms.btnP, fontSize: 12, padding: "6px 14px" }}
            onClick={() => pushToSurvey(filterProject)}
          >
            Import in survey
          </button>
        </div>
      ) : null}

      {filterProject && reportPack.length > 0 ? (
        <div className="geo-photos-report-pack">
          <div className="geo-photos-report-pack__head">
            <h3 className="geo-photos-report-pack__title">Report pack · {reportPack.length}</h3>
            <div className="geo-photo-capture__actions" style={{ marginTop: 0 }}>
              <button type="button" style={{ ...ms.btn, fontSize: 12, padding: "6px 12px" }} onClick={syncReportOrder}>
                Renumber
              </button>
              <button
                type="button"
                style={{ ...ms.btnP, fontSize: 12, padding: "6px 12px" }}
                onClick={() => pushToSurvey(filterProject)}
              >
                Import in survey
              </button>
            </div>
          </div>
          <p className="geo-photos-report-pack__lead">
            Order for PDF appendix — arrows change sequence of “In report” photos.
          </p>
          <ul className="geo-photos-report-pack__list">
            {reportPack.map((p, idx) => {
              const preset = geoPhotoPreset(p.type);
              return (
                <li key={p.id} className="geo-photos-report-pack__row">
                  <span className="geo-photos-report-pack__order">#{p.reportOrder ?? idx + 1}</span>
                  {geoPhotoHasRenderableMedia(p) ? (
                    <GeoPhotoImg photo={p} className="geo-photos-report-pack__thumb" />
                  ) : (
                    <span style={{ fontSize: 22 }}>{preset.icon}</span>
                  )}
                  <span className="geo-photos-report-pack__label">
                    <strong>{preset.label}</strong>
                    {p.notes ? ` — ${p.notes.slice(0, 50)}` : ""}
                  </span>
                  <button
                    type="button"
                    style={{ ...ms.btn, padding: "10px 12px", minHeight: 44, fontSize: 14, touchAction: "manipulation" }}
                    disabled={idx === 0}
                    onClick={() => moveReportPhoto(p.id, "up")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    style={{ ...ms.btn, padding: "10px 12px", minHeight: 44, fontSize: 14, touchAction: "manipulation" }}
                    disabled={idx === reportPack.length - 1}
                    onClick={() => moveReportPhoto(p.id, "down")}
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="geo-photos-stats">
        <span className="geo-photos-stats__pill">
          {filtered.length} photo{filtered.length === 1 ? "" : "s"}
          {safePhotos.length !== filtered.length ? ` · ${safePhotos.length} total` : ""}
        </span>
        {reportCount > 0 ? (
          <span className="geo-photos-stats__pill geo-photos-stats__pill--report">{reportCount} in report</span>
        ) : null}
        {orgName ? <span className="geo-photos-stats__pill">{orgName}</span> : null}
      </div>

      {selectedIds.size > 0 ? (
        <div className="geo-photos-bulk-bar">
          <span className="geo-photos-bulk-bar__count">{selectedIds.size} selected</span>
          <button type="button" style={ms.btn} onClick={() => bulkSetReport(true)}>
            Include in report
          </button>
          <button type="button" style={ms.btn} onClick={() => bulkSetReport(false)}>
            Exclude from report
          </button>
          <button type="button" style={ms.btnDanger} onClick={handleBulkDelete}>
            Delete selected
          </button>
          <button type="button" style={ms.btn} onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="geo-photos-map-wrap">
          <span className="geo-photos-map-wrap__label">Site map</span>
          <span className="geo-photos-map-wrap__hint">Tap marker for details</span>
          <GeoPhotosMap photos={filtered} height={320} satellite={satellite} onPhotoClick={setDetail} />
        </div>
      ) : safePhotos.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No geo-photos yet"
          description="Capture access routes, hazards or site conditions from your phone — GPS and direction arrow included."
          actionLabel="+ First geo-photo"
          onAction={() => setCaptureOpen(true)}
          variant="dashed"
        />
      ) : (
        <EmptyState
          icon="🔍"
          title="No photos match your filters"
          description={`${safePhotos.length} geo-photo${safePhotos.length === 1 ? "" : "s"} in this org — try clearing filters or choosing another project.`}
          actionLabel="Clear filters"
          onAction={clearFilters}
          variant="dashed"
          compact
        />
      )}

      <div className="geo-photos-grid">
        {listPg.visible(filtered).map((photo) => {
          const preset = geoPhotoPreset(photo.type);
          const selected = selectedIds.has(photo.id);
          return (
            <article key={photo.id} className="geo-photos-card" style={{ "--gp-accent": preset.color }}>
              <div
                className="geo-photos-card__media"
                onClick={() => setDetail(photo)}
                onKeyDown={(e) => e.key === "Enter" && setDetail(photo)}
                role="button"
                tabIndex={0}
              >
                {geoPhotoHasRenderableMedia(photo) ? (
                  <GeoPhotoImg photo={photo} loading="lazy" />
                ) : (
                  <div className="geo-photos-card__placeholder">{preset.icon}</div>
                )}
                <label className="geo-photos-card__select" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected} onChange={() => toggleSelect(photo.id)} />
                  Select
                </label>
                <span className="geo-photos-card__type">
                  {preset.icon} {preset.label}
                </span>
                {photo.bearing != null && !Number.isNaN(Number(photo.bearing)) ? (
                  <span className="geo-photos-card__bearing">{Math.round(Number(photo.bearing))}°</span>
                ) : null}
              </div>
              <div className="geo-photos-card__body">
                <div className="geo-photos-card__head">
                  <h4 className="geo-photos-card__title">{photo.projectName || "No project"}</h4>
                  <label
                    className={`geo-photos-card__report ${photo.includeInReport ? "geo-photos-card__report--on" : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={!!photo.includeInReport}
                      onChange={(e) =>
                        setPhotos((prev) =>
                          asPhotoArray(prev).map((p) =>
                            p.id === photo.id
                              ? {
                                  ...p,
                                  includeInReport: e.target.checked,
                                  reportOrder:
                                    e.target.checked && p.projectId
                                      ? (p.reportOrder ?? nextGeoPhotoReportOrder(asPhotoArray(prev), p.projectId))
                                      : e.target.checked
                                        ? p.reportOrder
                                        : null,
                                  updatedAt: new Date().toISOString(),
                                }
                              : p
                          )
                        )
                      }
                    />
                    In report
                  </label>
                </div>
                {photo.notes ? <p className="geo-photos-card__notes">{photo.notes}</p> : null}
                {geoPhotoDetailSummary(photo) ? (
                  <p className="geo-photos-card__observations">{geoPhotoDetailSummary(photo)}</p>
                ) : null}
                {geoPhotoRaisesAction(photo) ? (
                  <p
                    className={`geo-photos-card__action ${
                      geoPhotoActionResolved(photo) ? "geo-photos-card__action--done" : ""
                    }`}
                  >
                    {geoPhotoActionResolved(photo)
                      ? `Action closed ${fmtWhen(photo.actionResolvedAt)}${
                          photo.actionResolvedBy ? ` · ${photo.actionResolvedBy}` : ""
                        }`
                      : `Action outstanding${geoPhotoActionSeverity(photo) ? ` · ${geoPhotoActionSeverity(photo)}` : ""}`}
                  </p>
                ) : null}
                <div className="geo-photos-card__meta">{fmtWhen(photo.timestampUtc)}</div>
                <div className="geo-photos-card__actions">
                  <button type="button" style={{ ...ms.btn, padding: "8px 12px" }} onClick={() => setDetail(photo)}>
                    Open
                  </button>
                  {geoPhotoRaisesAction(photo) ? (
                    <button
                      type="button"
                      style={{
                        ...(geoPhotoActionResolved(photo) ? ms.btn : ms.btnP),
                        padding: "8px 12px",
                      }}
                      onClick={() => handleResolveAction(photo.id, !geoPhotoActionResolved(photo))}
                    >
                      {geoPhotoActionResolved(photo) ? "Reopen action" : "Mark action done"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    style={{ ...ms.btnDanger, padding: "8px 12px" }}
                    onClick={() => handleDelete(photo.id)}
                    aria-label={`Delete ${preset.label} photo`}
                  >
                    Delete
                  </button>
                </div>
                <div className="geo-photos-card__map">
                  <GeoPhotoDirectionMap
                    latitude={photo.latitude}
                    longitude={photo.longitude}
                    bearing={photo.bearing}
                    arrowColor={preset.color}
                    height={72}
                    interactive={false}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <RegisterListPagingFooter
        hasMore={listPg.hasMore(filtered)}
        remaining={listPg.remaining(filtered)}
        showing={Math.min(listPg.cap, filtered.length)}
        total={filtered.length}
        onShowMore={listPg.showMore}
        itemLabel="photos"
        buttonStyle={ms.btn}
      />

      <button type="button" className="geo-photos-fab" onClick={() => setCaptureOpen(true)} aria-label="Add geo-photo">
        + Photo
      </button>

      <GeoPhotoCaptureModal
        open={captureOpen}
        onClose={() => {
          setCaptureOpen(false);
          setCapturePreset("");
          setCaptureLinkedPermitId("");
        }}
        onSave={handleSaveNew}
        onCreateProject={handleQuickProject}
        projects={activeProjects}
        photos={safePhotos}
        initialProjectId={filterProject}
        initialPreset={capturePreset}
        linkedPermitId={captureLinkedPermitId}
      />

      {detail ? (
        <GeoPhotoDetail
          photo={detail}
          onClose={() => setDetail(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCreateSnag={createSnagFromPhoto}
          onOpenSurvey={pushToSurvey}
          onOpenPermit={openLinkedPermit}
          onResolveAction={handleResolveAction}
        />
      ) : null}
    </div>
  );
}
