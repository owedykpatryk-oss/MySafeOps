import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useD1WorkersProjectsSync } from "../hooks/useD1WorkersProjectsSync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { pushRecycleBinItem } from "../utils/recycleBin";
import PageHero from "../components/PageHero";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import GeoPhotosMap from "../components/geoPhotos/GeoPhotosMap";
import GeoPhotoCaptureModal from "../components/geoPhotos/GeoPhotoCaptureModal";
import GeoPhotoDirectionMap from "../components/geoPhotos/GeoPhotoDirectionMap";
import { geoPhotoPreset, geoPhotoPresetLabel, GEO_PHOTO_PRESETS } from "../utils/geoPhotoPresets";
import { consumeWorkspaceNavTarget, openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { ensureProjectLinked } from "../utils/projectRequiredGate";
import { isSurveyWorkflowEnabled } from "../utils/projectHubIndustry";
import { buildGeoPhotoMobilisationChecklist, geoPhotoGroupCoverage } from "../utils/geoPhotoMobilisation";
import { geoPhotoDisplayUrl } from "../utils/geoPhotoMedia";
import {
  downloadGeoJson,
  nextGeoPhotoReportOrder,
  normalizeGeoPhotoReportOrders,
  projectGeoPhotosForReport,
  reorderGeoPhotoReport,
  snagDraftFromGeoPhoto,
} from "../utils/geoPhotoIntegrations";

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
  a.download = `geo-photos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function GeoPhotoDetail({ photo, onClose, onUpdate, onDelete, onCreateSnag, onOpenSurvey }) {
  const preset = geoPhotoPreset(photo.type);
  const [notes, setNotes] = useState(photo.notes || "");
  const [includeInReport, setIncludeInReport] = useState(!!photo.includeInReport);
  const [bearing, setBearing] = useState(photo.bearing);

  useEffect(() => {
    setNotes(photo.notes || "");
    setIncludeInReport(!!photo.includeInReport);
    setBearing(photo.bearing);
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
        {geoPhotoDisplayUrl(photo) ? (
          <img src={geoPhotoDisplayUrl(photo)} alt="" className="geo-photo-modal__preview" />
        ) : null}
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
        </p>
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
            onClick={() =>
              onUpdate({
                ...photo,
                notes: notes.trim(),
                includeInReport,
                bearing,
                updatedAt: new Date().toISOString(),
              })
            }
          >
            Save changes
          </button>
          {photo.projectId && onOpenSurvey ? (
            <button type="button" style={ms.btn} onClick={() => onOpenSurvey(photo.projectId)}>
              Open survey report
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
  const { orgName } = useApp();
  const pendingGeoPhotoIdRef = useRef(null);
  const [photos, setPhotos] = useState(() => asPhotoArray(load(STORAGE_KEY, [])));
  const [workers, setWorkers] = useState(() => asPhotoArray(load("mysafeops_workers", [])));
  const [projects, setProjects] = useState(() => asPhotoArray(load("mysafeops_projects", [])));
  const [filterProject, setFilterProject] = useState("");
  const [filterReport, setFilterReport] = useState("all");
  const [filterType, setFilterType] = useState("");
  const [query, setQuery] = useState("");
  const [satellite, setSatellite] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: STORAGE_KEY,
    namespace: "geo_photos",
    value: photos,
    setValue: (next) => setPhotos(asPhotoArray(next)),
    load: (key, fallback) => asPhotoArray(load(key, fallback)),
    save,
  });

  useD1WorkersProjectsSync({
    workers,
    setWorkers: (next) => setWorkers(asPhotoArray(next)),
    projects,
    setProjects: (next) => setProjects(asPhotoArray(next)),
    load: (key, fallback) => asPhotoArray(load(key, fallback)),
    save,
  });

  useEffect(() => {
    const nav = consumeWorkspaceNavTarget();
    if (nav?.viewId !== "geo-photos") return;
    if (nav.projectId) setFilterProject(nav.projectId);
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

  const safePhotos = useMemo(() => asPhotoArray(photos), [photos]);
  const activeProjects = useMemo(() => asPhotoArray(projects).filter((p) => !p.closed), [projects]);
  const selectedProject = useMemo(
    () => activeProjects.find((p) => p.id === filterProject) || null,
    [activeProjects, filterProject]
  );
  const surveyPack = isSurveyWorkflowEnabled();

  const hasActiveFilters = Boolean(filterProject || filterReport !== "all" || filterType || query.trim());

  const clearFilters = () => {
    setFilterProject("");
    setFilterReport("all");
    setFilterType("");
    setQuery("");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safePhotos
      .filter((p) => {
        if (filterProject && p.projectId !== filterProject) return false;
        if (filterReport === "report" && !p.includeInReport) return false;
        if (filterReport === "exclude" && p.includeInReport) return false;
        if (filterType && p.type !== filterType) return false;
        if (!q) return true;
        const hay = [p.notes, p.projectName, geoPhotoPresetLabel(p.type), p.capturedBy].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) => new Date(b.timestampUtc || b.createdAt).getTime() - new Date(a.timestampUtc || a.createdAt).getTime()
      );
  }, [safePhotos, filterProject, filterReport, filterType, query]);

  const reportPack = useMemo(
    () => (filterProject ? projectGeoPhotosForReport(safePhotos, filterProject) : []),
    [safePhotos, filterProject]
  );

  const mobilisation = useMemo(
    () => (filterProject ? buildGeoPhotoMobilisationChecklist(safePhotos, filterProject, { surveyPack }) : null),
    [safePhotos, filterProject, surveyPack]
  );

  const groupCoverage = useMemo(
    () => (filterProject ? geoPhotoGroupCoverage(safePhotos, filterProject) : []),
    [safePhotos, filterProject]
  );

  const listPg = useRegisterListPaging(LIST_PAGE);

  useEffect(() => {
    listPg.reset();
  }, [filterProject, filterReport, filterType, query]);

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

  const handleSaveNew = useCallback(
    (row) => {
      if (!ensureProjectLinked({ projectId: row.projectId, projects: activeProjects, moduleLabel: "geo-photo" }))
        return;
      const enriched = { ...row };
      if (enriched.includeInReport && enriched.projectId) {
        enriched.reportOrder = nextGeoPhotoReportOrder(safePhotos, enriched.projectId);
      }
      setPhotos((prev) => [enriched, ...asPhotoArray(prev)]);
      pushAudit({
        action: "geo_photo_create",
        detail: `${geoPhotoPresetLabel(enriched.type)} — ${enriched.projectName || "no project"}`,
        module: "geo-photos",
      });
    },
    [safePhotos, activeProjects]
  );

  const handleUpdate = (row) => {
    setPhotos((prev) => asPhotoArray(prev).map((p) => (p.id === row.id ? row : p)));
    setDetail(null);
    pushAudit({ action: "geo_photo_update", detail: row.id, module: "geo-photos" });
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this geo-photo?")) return;
    const victim = safePhotos.find((p) => p.id === id);
    if (victim) {
      pushRecycleBinItem({
        moduleId: "geo-photos",
        moduleLabel: "Geo-photos",
        itemType: "geo_photo",
        itemLabel: geoPhotoPresetLabel(victim.type),
        sourceKey: STORAGE_KEY,
        payload: victim,
      });
    }
    setPhotos((prev) => asPhotoArray(prev).filter((p) => p.id !== id));
    setDetail(null);
    pushAudit({ action: "geo_photo_delete", detail: id, module: "geo-photos" });
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

  const syncReportOrder = () => {
    if (!filterProject) return;
    setPhotos((prev) => normalizeGeoPhotoReportOrders(prev, filterProject));
  };

  return (
    <div className="geo-photos-page">
      <PageHero
        badgeText="GP"
        title="Geo-photos"
        lead="Field photos with GPS and direction arrow — access routes, hazards, utilities and site conditions. Tick “Include in report”, then import into Survey report."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
          Type
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={ms.inp}>
            <option value="">All types</option>
            {GEO_PHOTO_PRESETS.map((p) => (
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
            Export GeoJSON
          </button>
        </div>
      </div>

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
                  {geoPhotoDisplayUrl(p) ? (
                    <img src={geoPhotoDisplayUrl(p)} alt="" className="geo-photos-report-pack__thumb" />
                  ) : (
                    <span style={{ fontSize: 22 }}>{preset.icon}</span>
                  )}
                  <span className="geo-photos-report-pack__label">
                    <strong>{preset.label}</strong>
                    {p.notes ? ` — ${p.notes.slice(0, 50)}` : ""}
                  </span>
                  <button
                    type="button"
                    style={{ ...ms.btn, padding: "4px 10px", fontSize: 12 }}
                    disabled={idx === 0}
                    onClick={() => moveReportPhoto(p.id, "up")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    style={{ ...ms.btn, padding: "4px 10px", fontSize: 12 }}
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
        <div className="geo-photos-empty">
          <div className="geo-photos-empty__icon" aria-hidden>
            📍
          </div>
          <h3 className="geo-photos-empty__title">No geo-photos yet</h3>
          <p className="geo-photos-empty__lead">
            Capture access routes, hazards or site conditions from your phone — GPS and direction arrow included.
          </p>
          <button type="button" style={ms.btnP} onClick={() => setCaptureOpen(true)}>
            + First geo-photo
          </button>
        </div>
      ) : (
        <div className="geo-photos-empty">
          <div className="geo-photos-empty__icon" aria-hidden>
            🔍
          </div>
          <h3 className="geo-photos-empty__title">No photos match your filters</h3>
          <p className="geo-photos-empty__lead">
            {safePhotos.length} geo-photo{safePhotos.length === 1 ? "" : "s"} in this org — try clearing filters or
            choosing another project.
          </p>
          <button type="button" style={ms.btn} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
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
                {geoPhotoDisplayUrl(photo) ? (
                  <img src={geoPhotoDisplayUrl(photo)} alt="" loading="lazy" />
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
                <div className="geo-photos-card__meta">{fmtWhen(photo.timestampUtc)}</div>
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

      {listPg.hasMore(filtered) ? (
        <div className="geo-photos-pager">
          <button type="button" style={ms.btn} onClick={listPg.showMore}>
            Show more ({listPg.remaining(filtered)} remaining)
          </button>
        </div>
      ) : null}

      <button type="button" className="geo-photos-fab" onClick={() => setCaptureOpen(true)} aria-label="Add geo-photo">
        + Photo
      </button>

      <GeoPhotoCaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSave={handleSaveNew}
        projects={activeProjects}
        initialProjectId={filterProject}
      />

      {detail ? (
        <GeoPhotoDetail
          photo={detail}
          onClose={() => setDetail(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCreateSnag={createSnagFromPhoto}
          onOpenSurvey={pushToSurvey}
        />
      ) : null}
    </div>
  );
}
