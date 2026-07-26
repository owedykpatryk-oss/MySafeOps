import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { ms } from "../utils/moduleStyles";
import { exportCsv } from "../utils/exportCsv";
import PageHero from "../components/PageHero";
import { getOrgId, loadOrgScoped as load, loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import { consumeWorkspaceNavTarget, openWorkspaceView } from "../utils/workspaceNavContext";
import { listProjectPlans } from "./permits/permitPlanOverlayRegistry";
import {
  PROJECT_DRAWING_OBJECT_TYPES,
  buildProjectDrawingObject,
  drawingObjectLabel,
  drawingObjectTypeMeta,
  drawingObjectCategories,
  objectsForProject,
  saveProjectDrawingObjects,
  listProjectDrawingObjects,
  isMapPlacement,
} from "./permits/projectDrawingRegistry";
import {
  DEFAULT_GEO_ANCHOR,
  buildDrawingObjectsGpx,
  buildDrawingObjectsKml,
  getObjectLatLng,
} from "./permits/projectDrawingGeo";
import { isDefaultGeoAnchor, parseProjectBoundaryRing, projectSiteLocationSignature } from "../utils/projectBoundary";
import { resolveProjectGeoAnchor } from "../utils/resolveProjectGeoAnchor";
import { loadDrawingEditorPrefs, saveDrawingEditorPrefs } from "./permits/projectDrawingEditorPrefs";
import {
  validateDrawingImportJson,
  parseKmlPoints,
  parseGpxPoints,
  parseGeoJsonPoints,
  parseKmlGeometry,
  boundaryFromKmlGeometry,
} from "./permits/projectDrawingImport";
import { readKmlTextFromFile } from "../utils/kmzExtract";
import { solvePlanAffineFromControlPoints } from "./permits/projectDrawingAffine";
import { PDE_AREA_KINDS, pdeAreaKindMeta, isPolygonDrawingObject } from "./permits/projectDrawingAreas";
import { projectBoundaryFromDraftRing } from "./permits/projectDrawingBoundary";
import { isR2StorageConfigured, uploadFileToR2Storage } from "../lib/r2Storage";
import { pushAudit } from "../utils/auditLog";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { syncOrgSlugIfNeeded } from "../utils/orgMembership";
import ProjectDrawingGeoMap from "./ProjectDrawingGeoMap";
import ProjectDrawingMapCanvas from "./ProjectDrawingMapCanvas";
import ProjectDrawingEmergencyIntel, {
  captureHospitalRoutePng,
  downloadHospitalRoutePng,
} from "./ProjectDrawingEmergencyIntel";
import ProjectDrawingSmartBar, { ProjectDrawingQuickChips } from "./ProjectDrawingSmartBar";
import ProjectDrawingEscapeRoutesPanel from "./ProjectDrawingEscapeRoutesPanel";
import ProjectDrawingMapLayers, { DEFAULT_PDE_MAP_LAYERS } from "./ProjectDrawingMapLayers";
import ProjectDrawingMapLegend, { buildMapLegendItems } from "./ProjectDrawingMapLegend";
import { computeProjectDrawingReadiness } from "./permits/projectDrawingReadiness";
import { buildSitePackKml, buildSitePackManifest, triggerBlobDownload } from "./permits/projectDrawingSitePack";
import { resolveHospitalRoute } from "../utils/hospitalRoute";
import {
  siteCoordFingerprint,
  siteEnrichmentMatchesCoords,
} from "../utils/siteEnrichment";
import { captureElementPngBlob } from "../utils/captureElementPng";
import ProjectSitePlanPanel from "./ProjectSitePlanPanel";

const pdeUi = {
  toolWrap: {
    display: "inline-flex",
    padding: 4,
    borderRadius: 12,
    background: "var(--color-background-secondary,#f1f5f9)",
    border: "1px solid var(--color-border-tertiary,#e2e8f0)",
    gap: 2,
    flexWrap: "wrap",
    alignItems: "center",
  },
  toolBtn: (active) => ({
    padding: "10px 16px",
    borderRadius: 9,
    border: active ? "1px solid #0d9488" : "1px solid transparent",
    background: active ? "var(--color-background-primary,#fff)" : "transparent",
    color: "var(--color-text-primary)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "DM Sans,sans-serif",
    minHeight: 44,
    lineHeight: 1.2,
    touchAction: "manipulation",
    boxShadow: active ? "0 1px 4px rgba(15,23,42,0.08)" : "none",
    transition: "background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
  }),
  toolHint: {
    fontSize: 11,
    color: "var(--color-text-secondary)",
    marginLeft: 10,
    letterSpacing: "0.02em",
  },
  toolbarDivider: {
    width: 1,
    height: 26,
    background: "var(--color-border-tertiary,#e2e8f0)",
    flexShrink: 0,
    alignSelf: "center",
  },
  zoomOverlayBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    border: "1px solid var(--color-border-tertiary,#e5e5e5)",
    background: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    touchAction: "manipulation",
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 500,
    boxShadow: "0 2px 10px rgba(15,23,42,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f172a",
    fontFamily: "DM Sans, system-ui, sans-serif",
  },
  cardAccent: {
    boxShadow: "inset 0 3px 0 0 #0d9488",
  },
  btnCompact: {
    fontSize: 12,
    minHeight: 44,
    padding: "10px 12px",
  },
  toast: {
    position: "fixed",
    bottom: 28,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "var(--z-toast, 80)",
    padding: "12px 20px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: "#f0fdfa",
    background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
    boxShadow: "0 8px 32px rgba(13, 148, 136, 0.45)",
    maxWidth: "min(92vw, 420px)",
    textAlign: "center",
    pointerEvents: "none",
  },
  siteChip: (tone = "ready") => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 999,
    border:
      tone === "warn"
        ? "1px solid #fcd34d"
        : tone === "loading"
          ? "1px solid #bae6fd"
          : "1px solid #99f6e4",
    background:
      tone === "warn"
        ? "#fffbeb"
        : tone === "loading"
          ? "#f0f9ff"
          : "var(--color-accent-muted,#f0fdfa)",
    color: tone === "warn" ? "#92400e" : "var(--color-text-primary)",
  }),
};

/** Orange override only — lazy `ms` access avoids cross-chunk TDZ at module init. */
const ssBtnO = {
  padding: "10px 14px",
  borderRadius: 6,
  border: "0.5px solid #c2410c",
  background: "#f97316",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "DM Sans,sans-serif",
  minHeight: 44,
  lineHeight: 1.3,
};
const ss = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "btnO") return ssBtnO;
      return ms[prop];
    },
  }
);

const HISTORY_CAP = 50;
const PDE_SESSION_KEY = "mysafeops_pde_session_v1";
const R2_UPLOADS_KEY = "mysafeops_r2_uploads";

const emptyControlPoint = () => ({ px: "", py: "", lat: "", lng: "" });

function loadR2UploadsList() {
  const list = loadOrgScoped(R2_UPLOADS_KEY, []);
  return Array.isArray(list) ? list : [];
}
function saveR2UploadsList(list) {
  saveOrgScoped(R2_UPLOADS_KEY, list);
}

function loadPdeSession() {
  try {
    return JSON.parse(sessionStorage.getItem(PDE_SESSION_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePdeSession(partial) {
  try {
    const cur = loadPdeSession();
    sessionStorage.setItem(PDE_SESSION_KEY, JSON.stringify({ ...cur, ...partial, savedAt: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

function markerStyle(type, selected, { placeOnly = false, largeHit = false } = {}) {
  const meta = drawingObjectTypeMeta(type);
  const size = largeHit || placeOnly ? 28 : 16;
  const base = {
    position: "absolute",
    width: size,
    height: size,
    transform: "translate(-50%,-50%)",
    border: selected ? "3px solid #fff" : "2px solid #fff",
    boxShadow: selected
      ? `0 0 0 2px ${meta.color}, 0 0 0 4px rgba(12,68,124,0.35)`
      : `0 0 0 1px ${meta.color}`,
    background: meta.color,
    pointerEvents: "auto",
    cursor: placeOnly ? "pointer" : "grab",
    zIndex: selected ? 3 : 2,
    touchAction: "none",
  };
  if (meta.shape === "circle") return { ...base, borderRadius: "50%" };
  if (meta.shape === "square") return { ...base, borderRadius: 3 };
  if (meta.shape === "diamond") return { ...base, borderRadius: 2, transform: "translate(-50%,-50%) rotate(45deg)" };
  if (meta.shape === "star") {
    return {
      ...base,
      width: 18,
      height: 18,
      borderRadius: 0,
      clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
    };
  }
  return { ...base, borderRadius: "50%" };
}

function snapValue(v, gridPercent) {
  if (!gridPercent || gridPercent <= 0) return v;
  return Math.max(0, Math.min(100, Math.round(v / gridPercent) * gridPercent));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function shortMapLabel(text, max = 22) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function ProjectDrawingEditor() {
  const { supabase } = useSupabaseAuth();
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  useD1OrgArraySync({
    storageKey: "mysafeops_projects",
    namespace: "mysafeops_projects",
    value: projects,
    setValue: setProjects,
    load,
    save: saveOrgScoped,
  });
  const refreshProjectPlans = useCallback(() => {
    setProjectPlans(listProjectPlans());
  }, []);

  const [projectPlans, setProjectPlans] = useState(() => listProjectPlans());

  const [rows, setRows] = useState(() => listProjectDrawingObjects());
  const [projectId, setProjectId] = useState("");
  const [planId, setPlanId] = useState("");

  const currentProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
  );

  const projectSiteLocationSig = useMemo(
    () => projectSiteLocationSignature(currentProject),
    [currentProject]
  );

  const projectBoundaryRing = useMemo(
    () => (currentProject ? parseProjectBoundaryRing(currentProject) : null),
    [currentProject]
  );

  const updateProjectRecord = useCallback(
    (updated) => {
      if (!updated?.id) return;
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
        saveOrgScoped("mysafeops_projects", next);
        return next;
      });
    },
    [setProjects]
  );
  const [objectType, setObjectType] = useState("zone");
  const [visibleType, setVisibleType] = useState("all");
  const [tool, setTool] = useState(() => {
    const t = loadPdeSession().tool;
    return t === "select" || t === "pan" || t === "place" || t === "boundary" || t === "area" || t === "route" ? t : "place";
  });
  const [placeOnly, setPlaceOnly] = useState(() => {
    const saved = loadPdeSession().placeOnly;
    if (typeof saved === "boolean") return saved;
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return true;
    return false;
  });
  const [areaKind, setAreaKind] = useState("exclusion");
  const [draftRing, setDraftRing] = useState([]);
  const [hospitalIntel, setHospitalIntel] = useState(null);
  const [showHospitalRoute, setShowHospitalRoute] = useState(true);
  const [hospitalBusy, setHospitalBusy] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [sitePackBusy, setSitePackBusy] = useState(false);
  const [showMapLegend, setShowMapLegend] = useState(() => loadPdeSession().showMapLegend !== false);
  const [mapLayers, setMapLayers] = useState(() => ({ ...DEFAULT_PDE_MAP_LAYERS }));
  const [highlightEscapeRouteId, setHighlightEscapeRouteId] = useState("");
  const [escapeRouteAppendMode, setEscapeRouteAppendMode] = useState(false);
  const [escapeRoutePointIndex, setEscapeRoutePointIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [snapGrid, setSnapGrid] = useState(() => Boolean(loadPdeSession().snapGrid));
  const [listFilter, setListFilter] = useState("");
  const [mapZoom, setMapZoom] = useState(() => {
    const z = Number(loadPdeSession().mapZoom);
    return Number.isFinite(z) ? clamp(z, 0.5, 3) : 1;
  });
  const [showMapLabels, setShowMapLabels] = useState(() => Boolean(loadPdeSession().showMapLabels ?? true));
  const [showGeoPreview, setShowGeoPreview] = useState(() => Boolean(loadPdeSession().showGeoPreview));
  const [geoAnchor, setGeoAnchor] = useState(() => ({ ...DEFAULT_GEO_ANCHOR }));
  const [siteGeoStatus, setSiteGeoStatus] = useState({ source: "default", busy: false, postcode: "" });
  const [planGeoMode, setPlanGeoMode] = useState("anchor");
  const [planAffine, setPlanAffine] = useState(null);
  const [controlPoints, setControlPoints] = useState(() => [emptyControlPoint(), emptyControlPoint(), emptyControlPoint()]);
  const [exportPermitRef, setExportPermitRef] = useState(() => String(loadPdeSession().exportPermitRef || ""));
  const [r2Busy, setR2Busy] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState(null);
  const [copyFallbackText, setCopyFallbackText] = useState("");
  const [showPdeOnboarding, setShowPdeOnboarding] = useState(() => {
    try {
      return !sessionStorage.getItem("pde_onboarding_v1");
    } catch {
      return true;
    }
  });
  const [workSurface, setWorkSurface] = useState(() => {
    const w = loadPdeSession().workSurface;
    return w === "map" || w === "plan" ? w : "plan";
  });
  const [mapBasemap, setMapBasemap] = useState(() => {
    const b = loadPdeSession().mapBasemap;
    return b === "satellite" ? "satellite" : "streets";
  });
  const mapCanvasRef = useRef(null);
  const mapClickOverrideRef = useRef(null);
  const highlightEscapeRouteIdRef = useRef("");
  const escapeRoutePointIndexRef = useRef(-1);
  const siteLocationSigRef = useRef("");
  const hospitalAutoFetchedRef = useRef(new Set());
  const workSurfaceRef = useRef(workSurface);
  const mapContentRef = useRef(null);
  const viewportRef = useRef(null);
  const listItemRefs = useRef({});
  const dragState = useRef(null);
  const rowsRef = useRef(rows);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const panPointer = useRef(null);
  const fieldSessionRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);
  const [, setHistUi] = useState(0);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const pushHistory = useCallback(() => {
    undoStack.current = [...undoStack.current, JSON.stringify(rowsRef.current)].slice(-HISTORY_CAP);
    redoStack.current = [];
    setHistUi((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    redoStack.current = [...redoStack.current, JSON.stringify(rowsRef.current)].slice(-HISTORY_CAP);
    try {
      const parsed = JSON.parse(prev);
      if (Array.isArray(parsed)) setRows(parsed);
    } catch {
      /* ignore */
    }
    setHistUi((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    undoStack.current = [...undoStack.current, JSON.stringify(rowsRef.current)].slice(-HISTORY_CAP);
    try {
      const parsed = JSON.parse(next);
      if (Array.isArray(parsed)) setRows(parsed);
    } catch {
      /* ignore */
    }
    setHistUi((n) => n + 1);
  }, []);

  const beginFieldSession = useCallback(() => {
    fieldSessionRef.current = JSON.stringify(rowsRef.current);
  }, []);

  const endFieldSession = useCallback(() => {
    const start = fieldSessionRef.current;
    fieldSessionRef.current = null;
    if (!start) return;
    const now = JSON.stringify(rowsRef.current);
    if (start === now) return;
    undoStack.current = [...undoStack.current, start].slice(-HISTORY_CAP);
    redoStack.current = [];
    setHistUi((n) => n + 1);
  }, []);

  const copySelectedCoords = useCallback(async () => {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const lines = ids
      .map((id) => {
        const row = rowsRef.current.find((r) => r.id === id);
        if (!row) return "";
        const line = isMapPlacement(row)
          ? `lat: ${Number(row.geoLat).toFixed(6)}, lng: ${Number(row.geoLng).toFixed(6)} (${drawingObjectLabel(row)})`
          : `x: ${Number(row.x).toFixed(2)}%, y: ${Number(row.y).toFixed(2)}% (${drawingObjectLabel(row)})`;
        const json = JSON.stringify({
          id: row.id,
          planId: row.planId,
          type: row.type,
          label: row.label,
          placement: row.placement || "plan",
          x: row.x,
          y: row.y,
          geoLat: row.geoLat,
          geoLng: row.geoLng,
        });
        return `${line}\n${json}`;
      })
      .filter(Boolean);
    const blob = lines.join("\n\n");
    try {
      await navigator.clipboard.writeText(blob);
      setToast("Copied coordinates to clipboard");
    } catch {
      setCopyFallbackText(blob);
      setToast("Select all and copy the text below");
    }
  }, []);

  const clearObjectsOnCurrentPlan = useCallback(() => {
    if (!projectId || !planId) return;
    const toRemove = rowsRef.current.filter(
      (r) => r.projectId === projectId && String(r.planId || "") === String(planId)
    );
    if (toRemove.length === 0) {
      window.alert("No objects are stored against this plan ID. Points without a plan ID appear on every plan.");
      return;
    }
    if (!window.confirm(`Remove ${toRemove.length} object(s) from this plan?`)) return;
    pushHistory();
    const ids = new Set(toRemove.map((r) => r.id));
    setRows((prev) => prev.filter((r) => !ids.has(r.id)));
    setSelectedIds((sel) => sel.filter((id) => !ids.has(id)));
  }, [projectId, planId, pushHistory]);

  const refreshPlans = useCallback(() => {
    setProjectPlans(listProjectPlans());
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refreshPlans();
    };
    const onStorage = () => refreshPlans();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshPlans]);

  useEffect(() => {
    const nav = consumeWorkspaceNavTarget();
    if (nav?.viewId === "project-drawings" && nav?.projectId) {
      setProjectId(String(nav.projectId));
      return;
    }
    if (projects[0]?.id) setProjectId(String(projects[0].id));
  }, [projects]);

  useEffect(() => {
    saveProjectDrawingObjects(rows);
  }, [rows]);

  const plansForCurrentProject = useMemo(
    () => projectPlans.filter((p) => p.projectId === projectId),
    [projectPlans, projectId]
  );

  const canUsePlanSurface = plansForCurrentProject.length > 0;

  useEffect(() => {
    if (!projectId) return;
    if (plansForCurrentProject.length === 0) {
      setPlanId("");
      return;
    }
    setPlanId((cur) => {
      if (cur && plansForCurrentProject.some((p) => p.id === cur)) return cur;
      const want = loadPdeSession().planByProject?.[projectId];
      if (want && plansForCurrentProject.some((p) => p.id === want)) return want;
      return plansForCurrentProject[0]?.id || "";
    });
  }, [plansForCurrentProject, projectId]);

  useEffect(() => {
    setHospitalIntel(null);
    setShowHospitalRoute(true);
    setHighlightEscapeRouteId("");
  }, [projectId]);

  const flyMapToAnchor = useCallback((anchor, zoom = 17) => {
    if (!anchor || workSurfaceRef.current !== "map") return;
    window.setTimeout(() => {
      mapCanvasRef.current?.flyTo(anchor.lat, anchor.lng, zoom);
    }, 120);
  }, []);

  const applyGeoAnchor = useCallback((anchor, meta = {}, { fly = false } = {}) => {
    if (!anchor || typeof anchor.lat !== "number" || typeof anchor.lng !== "number") return;
    setGeoAnchor({
      lat: anchor.lat,
      lng: anchor.lng,
      spanLat: typeof anchor.spanLat === "number" ? clamp(anchor.spanLat, 0.0005, 5) : DEFAULT_GEO_ANCHOR.spanLat,
      spanLng: typeof anchor.spanLng === "number" ? clamp(anchor.spanLng, 0.0005, 5) : DEFAULT_GEO_ANCHOR.spanLng,
    });
    setSiteGeoStatus((prev) => ({
      ...prev,
      source: meta.source || prev.source,
      postcode: meta.postcode || prev.postcode,
      busy: false,
    }));
    if (fly) flyMapToAnchor(anchor);
  }, [flyMapToAnchor]);

  const reapplyProjectSiteAnchor = useCallback(async () => {
    if (!projectId || !currentProject) return;
    setSiteGeoStatus((prev) => ({ ...prev, busy: true }));
    try {
      const resolved = await resolveProjectGeoAnchor(currentProject);
      applyGeoAnchor(resolved.anchor, { source: resolved.source, postcode: resolved.postcode || "" }, { fly: true });
      if (resolved.source === "default") {
        setToast("No site coordinates found — add postcode on the project or set anchor manually.");
      } else if (resolved.source === "postcode") {
        setToast(`Map centred on ${resolved.postcode || "project postcode"}`);
      } else {
        setToast("Map centred on project site");
      }
    } catch {
      setSiteGeoStatus((prev) => ({ ...prev, busy: false }));
      setToast("Could not resolve site location");
    }
  }, [projectId, currentProject, applyGeoAnchor]);

  useEffect(() => {
    if (!projectId) {
      siteLocationSigRef.current = "";
      setSiteGeoStatus({ source: "default", busy: false, postcode: "" });
      setGeoAnchor({ ...DEFAULT_GEO_ANCHOR });
      return undefined;
    }
    if (siteLocationSigRef.current === projectSiteLocationSig) return undefined;
    siteLocationSigRef.current = projectSiteLocationSig;

    let cancelled = false;
    const orgSaved = loadDrawingEditorPrefs().geoAnchorByProject?.[projectId];
    const sessSaved = loadPdeSession().geoAnchorByProject?.[projectId];
    const saved = orgSaved || sessSaved;
    const hasCustomSaved = saved && typeof saved.lat === "number" && typeof saved.lng === "number" && !isDefaultGeoAnchor(saved);

    if (hasCustomSaved) {
      applyGeoAnchor(saved, { source: "saved" });
      return undefined;
    }

    setSiteGeoStatus((prev) => ({ ...prev, busy: true }));
    (async () => {
      try {
        const resolved = await resolveProjectGeoAnchor(currentProject);
        if (cancelled) return;
        applyGeoAnchor(resolved.anchor, { source: resolved.source, postcode: resolved.postcode || "" }, { fly: true });
      } catch {
        if (!cancelled) {
          setSiteGeoStatus((prev) => ({ ...prev, busy: false }));
          setGeoAnchor({ ...DEFAULT_GEO_ANCHOR });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, projectSiteLocationSig, currentProject, applyGeoAnchor]);

  useEffect(() => {
    const wasMap = workSurfaceRef.current === "map";
    workSurfaceRef.current = workSurface;
    if (!projectId || workSurface !== "map" || wasMap) return undefined;
    flyMapToAnchor(geoAnchor);
    return undefined;
  }, [workSurface, projectId, geoAnchor.lat, geoAnchor.lng, flyMapToAnchor]);

  useEffect(() => {
    if (!projectId || !planId) {
      setPlanGeoMode("anchor");
      setPlanAffine(null);
      setControlPoints([emptyControlPoint(), emptyControlPoint(), emptyControlPoint()]);
      return;
    }
    const key = `${projectId}::${planId}`;
    const pg = loadDrawingEditorPrefs().planGeoByPlanKey?.[key];
    if (pg?.mode === "affine" && pg.affine && typeof pg.affine.a === "number") {
      setPlanGeoMode("affine");
      setPlanAffine(pg.affine);
      const cps = pg.controlPoints;
      if (Array.isArray(cps) && cps.length === 3) {
        setControlPoints(
          cps.map((c) => ({
            px: c.px != null && c.px !== "" ? String(c.px) : "",
            py: c.py != null && c.py !== "" ? String(c.py) : "",
            lat: c.lat != null && c.lat !== "" ? String(c.lat) : "",
            lng: c.lng != null && c.lng !== "" ? String(c.lng) : "",
          }))
        );
      } else {
        setControlPoints([emptyControlPoint(), emptyControlPoint(), emptyControlPoint()]);
      }
    } else {
      setPlanGeoMode("anchor");
      setPlanAffine(null);
      setControlPoints([emptyControlPoint(), emptyControlPoint(), emptyControlPoint()]);
    }
  }, [projectId, planId]);

  useEffect(() => {
    const cur = loadPdeSession();
    savePdeSession({
      mapZoom,
      tool,
      placeOnly,
      snapGrid,
      showMapLabels,
      showMapLegend,
      showGeoPreview,
      workSurface,
      mapBasemap,
      exportPermitRef,
      geoAnchorByProject: { ...(cur.geoAnchorByProject || {}), ...(projectId ? { [projectId]: geoAnchor } : {}) },
      planByProject: { ...(cur.planByProject || {}), ...(projectId ? { [projectId]: planId } : {}) },
    });
    if (projectId) {
      const p = loadDrawingEditorPrefs();
      saveDrawingEditorPrefs({
        geoAnchorByProject: { ...(p.geoAnchorByProject || {}), [projectId]: geoAnchor },
      });
    }
  }, [mapZoom, tool, placeOnly, snapGrid, showMapLabels, showMapLegend, showGeoPreview, workSurface, mapBasemap, geoAnchor, projectId, planId, exportPermitRef]);

  useEffect(() => {
    if (!projectId) return;
    if (!canUsePlanSurface) setWorkSurface("map");
  }, [projectId, canUsePlanSurface]);

  const objects = useMemo(() => objectsForProject(projectId, rows), [projectId, rows]);
  const visibleObjects = useMemo(
    () => objects.filter((row) => (visibleType === "all" ? true : row.type === visibleType)),
    [objects, visibleType]
  );

  const filteredList = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return visibleObjects;
    return visibleObjects.filter((row) => {
      const label = String(row.label || "").toLowerCase();
      const typeLbl = drawingObjectTypeMeta(row.type).label.toLowerCase();
      return (
        label.includes(q) ||
        drawingObjectLabel(row).toLowerCase().includes(q) ||
        typeLbl.includes(q)
      );
    });
  }, [visibleObjects, listFilter]);

  const selectedPlan = useMemo(
    () => plansForCurrentProject.find((p) => p.id === planId) || null,
    [plansForCurrentProject, planId]
  );

  const effectiveAffine = useMemo(() => {
    if (planGeoMode !== "affine" || !planAffine) return null;
    return planAffine;
  }, [planGeoMode, planAffine]);

  const primaryId = useMemo(
    () => (selectedIds.length ? selectedIds[selectedIds.length - 1] : null),
    [selectedIds]
  );
  const selectedRow = useMemo(() => (primaryId ? objects.find((o) => o.id === primaryId) || null : null), [objects, primaryId]);

  const gridStep = snapGrid ? 5 : 0;

  const addObject = (partial = {}) => {
    if (!projectId) return;
    pushHistory();
    const x = gridStep ? snapValue(partial.x ?? 50, gridStep) : partial.x ?? 50;
    const y = gridStep ? snapValue(partial.y ?? 50, gridStep) : partial.y ?? 50;
    const next = buildProjectDrawingObject({
      projectId,
      planId: partial.planId ?? planId,
      type: partial.type ?? objectType,
      label: partial.label ?? "",
      x,
      y,
    });
    setRows((prev) => [next, ...prev].slice(0, 1500));
    setSelectedIds([next.id]);
    return next;
  };

  const upsertObject = useCallback(
    (id, patch) => {
      const at = new Date().toISOString();
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          let next = { ...row, ...patch, updatedAt: at };
          if (patch.meta && typeof patch.meta === "object") {
            next.meta = { ...(row.meta || {}), ...patch.meta };
          }
          const isMap = next.placement === "map" || row.placement === "map";
          if (gridStep && (patch.x != null || patch.y != null) && !isMap) {
            next.x = snapValue(next.x, gridStep);
            next.y = snapValue(next.y, gridStep);
          }
          return next;
        })
      );
    },
    [gridStep]
  );

  const removeObject = useCallback(
    (id, skipConfirm = false) => {
      if (!id) return;
      if (!skipConfirm && !window.confirm("Remove this drawing object?")) return;
      pushHistory();
      setRows((prev) => prev.filter((row) => row.id !== id));
      setSelectedIds((sel) => sel.filter((x) => x !== id));
    },
    [pushHistory]
  );

  const removeSelectedBulk = useCallback(
    (skipConfirm = false) => {
      const ids = selectedIdsRef.current;
      if (ids.length === 0) return;
      if (!skipConfirm && !window.confirm(`Remove ${ids.length} selected object(s)?`)) return;
      pushHistory();
      const rm = new Set(ids);
      setRows((prev) => prev.filter((row) => !rm.has(row.id)));
      setSelectedIds([]);
    },
    [pushHistory]
  );

  const duplicateObject = (row) => {
    if (!projectId || !row) return;
    pushHistory();
    if (isMapPlacement(row) && Number.isFinite(row.geoLat) && Number.isFinite(row.geoLng)) {
      const next = buildProjectDrawingObject({
        projectId,
        planId: "",
        type: row.type,
        label: row.label ? `${String(row.label).slice(0, 100)} (copy)` : "",
        x: 50,
        y: 50,
        placement: "map",
        geoLat: row.geoLat + 0.00012,
        geoLng: row.geoLng + 0.00012,
        meta: row.type === "atex_zone" && row.meta ? { ...row.meta } : undefined,
      });
      setRows((prev) => [next, ...prev].slice(0, 1500));
      setSelectedIds([next.id]);
      return;
    }
    const next = buildProjectDrawingObject({
      projectId,
      planId: row.planId || planId,
      type: row.type,
      label: row.label ? `${String(row.label).slice(0, 100)} (copy)` : "",
      x: Math.min(100, (row.x || 0) + 3),
      y: Math.min(100, (row.y || 0) + 3),
      meta: row.type === "atex_zone" && row.meta ? { ...row.meta } : undefined,
    });
    setRows((prev) => [next, ...prev].slice(0, 1500));
    setSelectedIds([next.id]);
  };

  const exportObjectsJson = () => {
    const payload = objects.map(
      ({ id, projectId: pid, planId: pl, type, label, x, y, placement, geoLat, geoLng, createdAt, updatedAt }) => ({
        id,
        projectId: pid,
        planId: pl,
        type,
        label,
        x,
        y,
        placement,
        geoLat,
        geoLng,
        createdAt,
        updatedAt,
      })
    );
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projectId, objects: payload }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-drawing-objects-${projectId || "all"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("JSON export started");
  };

  const exportGeoJson = () => {
    const planName = selectedPlan?.name || "";
    const permitRef = String(exportPermitRef || "").trim();
    const fc = {
      type: "FeatureCollection",
      name: `project-${projectId}-drawing-objects`,
      properties: {
        crs: "EPSG:4326",
        crsName: "WGS 84",
        coordinateOrder: "[longitude, latitude] per RFC 7946",
        units: "decimal degrees",
        accuracyNote:
          "Illustrative positions: plan-based points use the editor anchor or 3-point affine; map (GPS) points use stored lat/lng. Not survey-grade.",
        note: "WGS84 lon/lat. Plan points use anchor or affine; map points use stored GPS.",
        projectId,
        planId: planId || null,
        planName,
        permitRef: permitRef || null,
        exportedAt: new Date().toISOString(),
      },
      features: objects.map((row) => {
        const { lat, lng } = getObjectLatLng(row, geoAnchor, effectiveAffine);
        return {
          type: "Feature",
          id: row.id,
          properties: {
            id: row.id,
            projectId: row.projectId,
            planId: row.planId,
            objectType: row.type,
            placement: row.placement || "plan",
            label: row.label || drawingObjectLabel(row),
            xPercent: row.x,
            yPercent: row.y,
            geoLat: row.geoLat,
            geoLng: row.geoLng,
            permitRef: permitRef || undefined,
          },
          geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
        };
      }),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-drawing-${projectId || "objects"}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("GeoJSON export started");
  };

  const exportKmlBlob = () => {
    if (!projectId || objects.length === 0) return null;
    const kml = buildDrawingObjectsKml({
      projectId,
      planName: selectedPlan?.name || "",
      objects,
      anchor: geoAnchor,
      affine: effectiveAffine,
      permitRef: String(exportPermitRef || "").trim(),
    });
    return new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  };

  const exportKml = () => {
    const blob = exportKmlBlob();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-drawing-${projectId || "export"}.kml`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("KML export started");
  };

  const exportGpx = () => {
    if (!projectId || objects.length === 0) return;
    const gpx = buildDrawingObjectsGpx({
      projectId,
      planName: selectedPlan?.name || "",
      objects,
      anchor: geoAnchor,
      affine: effectiveAffine,
      permitRef: String(exportPermitRef || "").trim(),
    });
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-drawing-${projectId || "export"}.gpx`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("GPX export started");
  };

  const importObjectsJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        const validated = validateDrawingImportJson(data);
        if (!validated.ok) {
          window.alert(`Import validation failed:\n\n${validated.errors.join("\n")}`);
          return;
        }
        const incoming = validated.objects;
        const targetPid = projectId || data.projectId;
        if (!targetPid) {
          window.alert("Select a project first, then import.");
          return;
        }
        if (!window.confirm(`Import ${incoming.length} object(s) into this project? Existing IDs will be regenerated to avoid clashes.`)) return;
        pushHistory();
        const merged = incoming.map((raw) =>
          buildProjectDrawingObject({
            projectId: targetPid,
            planId: raw.planId || planId || "",
            type: raw.type || "zone",
            label: raw.label || "",
            x: raw.x ?? 50,
            y: raw.y ?? 50,
            placement: raw.placement === "map" ? "map" : undefined,
            geoLat: raw.geoLat,
            geoLng: raw.geoLng,
          })
        );
        setRows((prev) => [...merged, ...prev].slice(0, 1500));
        setSelectedIds(merged[0]?.id ? [merged[0].id] : []);
        setToast(`Imported ${merged.length} object(s)`);
      } catch {
        window.alert("Invalid JSON (parse error). Check the file is UTF-8 JSON.");
      }
    };
    reader.readAsText(file);
  };

  const importKmlOrGpxFile = async (file, kind) => {
    if (!projectId) {
      window.alert("Select a project first.");
      return;
    }
    try {
      let text = "";
      if (kind === "kml") {
        text = await readKmlTextFromFile(file);
      } else {
        text = await file.text();
      }

      if (kind === "gpx") {
        const pts = parseGpxPoints(text);
        if (pts.length === 0) {
          setToast("No waypoints found in GPX");
          return;
        }
        if (!window.confirm(`Import ${pts.length} waypoint(s) as map (GPS) objects?`)) return;
        pushHistory();
        const merged = pts.map((p) =>
          buildProjectDrawingObject({
            projectId,
            planId: "",
            type: objectType,
            label: p.name ? p.name.slice(0, 120) : "",
            x: 50,
            y: 50,
            placement: "map",
            geoLat: p.lat,
            geoLng: p.lng,
          })
        );
        setRows((prev) => [...merged, ...prev].slice(0, 1500));
        setSelectedIds(merged[0]?.id ? [merged[0].id] : []);
        setWorkSurface("map");
        setToast(`Imported ${merged.length} point(s) from GPX`);
        return;
      }

      // KML / KMZ — polygons (site areas) + Point placemarks
      const geom = parseKmlGeometry(text);
      const polys = geom.polygons || [];
      const pts = geom.points?.length ? geom.points : polys.length ? [] : parseKmlPoints(text);
      if (!pts.length && !polys.length) {
        setToast("No points or polygons found in KML/KMZ");
        return;
      }
      const bits = [];
      if (polys.length) bits.push(`${polys.length} area(s)`);
      if (pts.length) bits.push(`${pts.length} point(s)`);
      if (!window.confirm(`Import ${bits.join(" + ")} from ${file.name || "KML"}?`)) return;

      pushHistory();
      const areaRows = polys.map((poly) => {
        const ring = poly.ring.map((p) => ({ geoLat: p.lat, geoLng: p.lng }));
        return buildProjectDrawingObject({
          projectId,
          planId: "",
          type: "site_area",
          label: poly.name ? poly.name.slice(0, 120) : "Imported area",
          x: 50,
          y: 50,
          placement: "map",
          geometry: "polygon",
          ring,
          meta: { areaKind: areaKind || "exclusion", importedFrom: file.name || "kml" },
        });
      });
      const pointRows = pts.map((p) =>
        buildProjectDrawingObject({
          projectId,
          planId: "",
          type: objectType,
          label: p.name ? p.name.slice(0, 120) : "",
          x: 50,
          y: 50,
          placement: "map",
          geoLat: p.lat,
          geoLng: p.lng,
        })
      );
      const merged = [...areaRows, ...pointRows];
      setRows((prev) => [...merged, ...prev].slice(0, 1500));
      setSelectedIds(merged[0]?.id ? [merged[0].id] : []);
      setWorkSurface("map");

      if (polys.length && currentProject) {
        const boundary = boundaryFromKmlGeometry(geom, { sourceName: file.name || "KML/KMZ import" });
        if (boundary) {
          const hasBoundary = Array.isArray(currentProject.boundaryPoints) && currentProject.boundaryPoints.length >= 3;
          if (!hasBoundary || window.confirm("Also set this polygon as the project site boundary?")) {
            updateProjectRecord({
              ...currentProject,
              ...boundary,
              boundaryImportedAt: new Date().toISOString(),
            });
          }
        }
      }

      setToast(`Imported ${bits.join(" + ")} from ${file.name || "KML"}`);
      window.setTimeout(() => mapCanvasRef.current?.fitObjects?.(), 220);
    } catch (e) {
      setToast(e?.message || "Import failed");
    }
  };

  const importGeoJsonFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const pts = parseGeoJsonPoints(String(reader.result || ""));
      if (pts.length === 0) {
        setToast("No Point features found in GeoJSON");
        return;
      }
      if (!projectId) {
        window.alert("Select a project first.");
        return;
      }
      if (!window.confirm(`Import ${pts.length} point(s) from GeoJSON as map (GPS) objects?`)) return;
      pushHistory();
      const merged = pts.map((p) =>
        buildProjectDrawingObject({
          projectId,
          planId: "",
          type: p.type || objectType,
          label: (p.label || p.name || "").slice(0, 120),
          x: 50,
          y: 50,
          placement: "map",
          geoLat: p.lat,
          geoLng: p.lng,
        })
      );
      setRows((prev) => [...merged, ...prev].slice(0, 1500));
      setSelectedIds(merged[0]?.id ? [merged[0].id] : []);
      setWorkSurface("map");
      setToast(`Imported ${merged.length} point(s) from GeoJSON`);
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    if (!projectId || objects.length === 0) return;
    const permitRef = String(exportPermitRef || "").trim();
    const headers = ["id", "objectType", "label", "placement", "xPercent", "yPercent", "lat", "lng", "projectId", "planId", "permitRef"];
    const rows = objects.map((row) => {
      const { lat, lng } = getObjectLatLng(row, geoAnchor, effectiveAffine);
      return [
        row.id,
        row.type,
        row.label || drawingObjectLabel(row),
        row.placement || "plan",
        row.x,
        row.y,
        lat,
        lng,
        row.projectId,
        row.planId,
        permitRef,
      ];
    });
    exportCsv(headers, rows, `project-drawing-${projectId || "export"}.csv`);
    setToast("CSV export started");
  };

  const r2Enabled = isR2StorageConfigured();

  const uploadBlobToOrgR2 = useCallback(
    async (blob, filename) => {
      if (!blob || !r2Enabled) return null;
      setR2Busy(true);
      let orgIdForPath = getOrgId();
      if (isSupabaseConfigured() && supabase) {
        try {
          orgIdForPath = await syncOrgSlugIfNeeded(supabase);
        } catch {
          /* keep getOrgId */
        }
      }
      try {
        const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
        const result = await uploadFileToR2Storage(file, { orgId: orgIdForPath, subPath: "documents" });
        const row = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          name: filename,
          key: result.key,
          size: result.size,
          publicUrl: result.publicUrl,
          signedUrl: result.signedUrl || null,
          signedExpiresAt: result.signedExpiresAt || null,
          uploadedAt: new Date().toISOString(),
          source: "project-drawing-editor",
        };
        const next = [row, ...loadR2UploadsList()];
        saveR2UploadsList(next);
        pushAudit({ action: "r2_upload", entity: "document", detail: result.key });
        setToast(`Uploaded ${filename} to cloud library`);
        return result.signedUrl || result.publicUrl || null;
      } catch (e) {
        setToast(e?.message || "Upload failed");
        return null;
      } finally {
        setR2Busy(false);
      }
    },
    [r2Enabled, supabase]
  );

  const uploadLastKmlToR2 = async () => {
    const blob = exportKmlBlob();
    if (!blob || !projectId) {
      setToast("Nothing to upload");
      return;
    }
    await uploadBlobToOrgR2(blob, `project-drawing-${projectId}.kml`);
  };

  const uploadMapPngToR2 = async () => {
    await captureMapPng();
  };

  const siteCoordsForHospital = useMemo(() => {
    const plat = parseFloat(String(currentProject?.lat ?? "").trim());
    const plng = parseFloat(String(currentProject?.lng ?? "").trim());
    if (Number.isFinite(plat) && Number.isFinite(plng)) return { lat: plat, lng: plng };
    if (Number.isFinite(geoAnchor.lat) && Number.isFinite(geoAnchor.lng) && !isDefaultGeoAnchor(geoAnchor)) {
      return { lat: geoAnchor.lat, lng: geoAnchor.lng };
    }
    return { lat: geoAnchor.lat, lng: geoAnchor.lng };
  }, [currentProject?.lat, currentProject?.lng, geoAnchor]);

  const fetchHospitalRoute = useCallback(async () => {
    if (!projectId) return;
    const { lat, lng } = siteCoordsForHospital;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setToast("Set project site coordinates or postcode first");
      return;
    }
    setHospitalBusy(true);
    try {
      const resolved = await resolveHospitalRoute(lat, lng);
      if (!resolved) {
        setToast("No hospital found within 25 km — check site coordinates");
        setHospitalIntel(null);
        return;
      }
      const fp = siteCoordFingerprint(lat, lng);
      setHospitalIntel({ ...resolved, siteFp: fp });
      setShowHospitalRoute(true);
      window.setTimeout(() => mapCanvasRef.current?.fitHospitalRoute(resolved.ring), 200);
      updateProjectRecord({
        ...currentProject,
        nearestHospital: resolved.hospital.summary,
        hospitalDirectionsUrl: resolved.hospital.directions_url,
        siteEnrichmentFor: fp,
        siteEnrichmentAt: new Date().toISOString(),
      });
      setToast(`A&E for this site pin — ${resolved.hospital.name}`);
    } catch {
      setToast("Hospital lookup failed");
    } finally {
      setHospitalBusy(false);
    }
  }, [projectId, siteCoordsForHospital, currentProject, updateProjectRecord]);

  useEffect(() => {
    if (!projectId || workSurface !== "map") return undefined;
    const { lat, lng } = siteCoordsForHospital;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    if (siteGeoStatus.source === "default" || siteGeoStatus.busy) return undefined;
    if (hospitalBusy) return undefined;

    const fp = siteCoordFingerprint(lat, lng);
    const key = `${projectId}:${fp}`;
    if (hospitalAutoFetchedRef.current.has(key)) return undefined;

    const projectHospitalFits =
      siteEnrichmentMatchesCoords(currentProject, lat, lng) && Boolean(currentProject?.nearestHospital);
    const intelFits = Boolean(hospitalIntel?.hospital) && hospitalIntel.siteFp === fp;

    if (projectHospitalFits || intelFits) {
      hospitalAutoFetchedRef.current.add(key);
      return undefined;
    }

    // Stale A&E from another postcode — drop it and fetch for the current pin.
    if (currentProject?.nearestHospital && !siteEnrichmentMatchesCoords(currentProject, lat, lng)) {
      updateProjectRecord({
        ...currentProject,
        nearestHospital: "",
        hospitalDirectionsUrl: "",
        siteEnrichmentFor: "",
        siteEnrichmentAt: "",
      });
    }
    if (hospitalIntel && hospitalIntel.siteFp !== fp) setHospitalIntel(null);

    hospitalAutoFetchedRef.current.add(key);
    fetchHospitalRoute();
    return undefined;
  }, [
    projectId,
    workSurface,
    hospitalIntel,
    hospitalBusy,
    currentProject,
    siteCoordsForHospital.lat,
    siteCoordsForHospital.lng,
    siteGeoStatus.source,
    siteGeoStatus.busy,
    fetchHospitalRoute,
    updateProjectRecord,
  ]);

  const captureHospitalScreenshot = useCallback(async () => {
    if (!projectId || !hospitalIntel?.ring?.length) return;
    setCaptureBusy(true);
    const prevView = mapCanvasRef.current?.getView?.() || null;
    try {
      if (!showHospitalRoute) setShowHospitalRoute(true);
      // Fit route for the capture frame, then restore site view so the map doesn't stay zoomed out
      await new Promise((r) => window.setTimeout(r, 80));
      mapCanvasRef.current?.fitHospitalRoute?.(hospitalIntel.ring, { maxZoom: 14 });
      await new Promise((r) => window.setTimeout(r, 450));
      const blob = await captureHospitalRoutePng();
      if (!blob) {
        setToast("Screenshot failed — try again");
        return;
      }
      downloadHospitalRoutePng(blob, projectId);
      const filename = `hospital-route-${projectId}.png`;
      const publicUrl = await uploadBlobToOrgR2(blob, filename);
      const patch = {
        ...currentProject,
        nearestHospital: hospitalIntel.hospital.summary || currentProject?.nearestHospital,
        hospitalDirectionsUrl: hospitalIntel.hospital.directions_url || currentProject?.hospitalDirectionsUrl,
        hospitalRouteScreenshotUrl: publicUrl || currentProject?.hospitalRouteScreenshotUrl || "",
        hospitalRouteCapturedAt: new Date().toISOString(),
        ...(publicUrl && !currentProject?.siteMapUrl ? { siteMapUrl: publicUrl } : {}),
      };
      updateProjectRecord(patch);
      setToast(publicUrl ? "Screenshot saved — link stored on project" : "PNG downloaded — enable cloud for shareable link");
    } catch {
      setToast("Screenshot capture failed");
    } finally {
      if (prevView) {
        mapCanvasRef.current?.setView?.(prevView.lat, prevView.lng, prevView.zoom);
      }
      setCaptureBusy(false);
    }
  }, [projectId, hospitalIntel, showHospitalRoute, currentProject, uploadBlobToOrgR2, updateProjectRecord]);

  const persistPlanGeoEntry = useCallback((entry) => {
    if (!projectId || !planId) return;
    const key = `${projectId}::${planId}`;
    const p = loadDrawingEditorPrefs();
    saveDrawingEditorPrefs({
      planGeoByPlanKey: { ...(p.planGeoByPlanKey || {}), [key]: entry },
    });
  }, [projectId, planId]);

  const applyAffineCalibration = useCallback(() => {
    const pts = controlPoints.map((c) => ({
      px: Number(c.px),
      py: Number(c.py),
      lat: Number(c.lat),
      lng: Number(c.lng),
    }));
    const aff = solvePlanAffineFromControlPoints(pts);
    if (!aff) {
      window.alert("Enter three non-collinear plan points (x%, y% on the plan) with matching WGS84 lat/lng.");
      return;
    }
    setPlanAffine(aff);
    setPlanGeoMode("affine");
    const cps = controlPoints.map((c) => ({
      px: c.px === "" ? null : Number(c.px),
      py: c.py === "" ? null : Number(c.py),
      lat: c.lat === "" ? null : Number(c.lat),
      lng: c.lng === "" ? null : Number(c.lng),
    }));
    persistPlanGeoEntry({ mode: "affine", affine: aff, controlPoints: cps });
    setToast("3-point calibration applied for this plan");
  }, [controlPoints, persistPlanGeoEntry]);

  const resetPlanGeoCalibration = useCallback(() => {
    setPlanGeoMode("anchor");
    setPlanAffine(null);
    setControlPoints([emptyControlPoint(), emptyControlPoint(), emptyControlPoint()]);
    persistPlanGeoEntry({ mode: "anchor" });
    setToast("Plan georeferencing reset to anchor box");
  }, [persistPlanGeoEntry]);

  const planObjectsForMap = useMemo(() => {
    if (!selectedPlan) return [];
    return visibleObjects.filter(
      (row) =>
        row.placement !== "map" &&
        row.geometry !== "polygon" &&
        (!row.planId || row.planId === selectedPlan.id)
    );
  }, [visibleObjects, selectedPlan]);

  const mapObjectsForCanvas = useMemo(
    () =>
      visibleObjects.filter(
        (row) =>
          row.placement === "map" &&
          row.geometry !== "polygon" &&
          Number.isFinite(row.geoLat) &&
          Number.isFinite(row.geoLng)
      ),
    [visibleObjects]
  );

  const mapAreaObjects = useMemo(
    () =>
      visibleObjects.filter(
        (row) => row.placement === "map" && isPolygonDrawingObject(row)
      ),
    [visibleObjects]
  );

  const planAreaObjects = useMemo(() => {
    if (!selectedPlan) return [];
    return visibleObjects.filter(
      (row) =>
        isPolygonDrawingObject(row) &&
        row.placement !== "map" &&
        (!row.planId || row.planId === selectedPlan.id)
    );
  }, [visibleObjects, selectedPlan]);

  const planTypeStats = useMemo(() => {
    const counts = Object.fromEntries(PROJECT_DRAWING_OBJECT_TYPES.map((t) => [t.id, 0]));
    const statRows = workSurface === "map" ? mapObjectsForCanvas : planObjectsForMap;
    for (const row of statRows) {
      if (counts[row.type] != null) counts[row.type] += 1;
    }
    return counts;
  }, [workSurface, mapObjectsForCanvas, planObjectsForMap]);

  const activeTypeStats = useMemo(
    () => PROJECT_DRAWING_OBJECT_TYPES.filter((meta) => (planTypeStats[meta.id] ?? 0) > 0),
    [planTypeStats]
  );

  const escapeRoutesForMap = useMemo(
    () => (Array.isArray(currentProject?.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : []),
    [currentProject?.mapEscapeRoutes]
  );

  const draftMode = tool === "route" ? "route" : "polygon";

  const mapLegendItems = useMemo(
    () =>
      buildMapLegendItems({
        markerTypes: activeTypeStats,
        typeCounts: planTypeStats,
        hasBoundary: Boolean(projectBoundaryRing?.length >= 3),
        showBoundary: mapLayers.boundary,
        escapeRouteCount: escapeRoutesForMap.length,
        showEscapeRoutes: mapLayers.escapeRoutes,
        showHospitalRoute: Boolean(showHospitalRoute && hospitalIntel?.ring?.length),
        showHospitalLayer: mapLayers.hospitalRoute,
      }),
    [
      activeTypeStats,
      planTypeStats,
      projectBoundaryRing,
      mapLayers.boundary,
      mapLayers.escapeRoutes,
      mapLayers.hospitalRoute,
      escapeRoutesForMap.length,
      showHospitalRoute,
      hospitalIntel?.ring?.length,
    ]
  );

  const siteReadiness = useMemo(
    () =>
      computeProjectDrawingReadiness({
        siteOk: siteGeoStatus.source && siteGeoStatus.source !== "default",
        hasBoundary: Boolean(projectBoundaryRing?.length >= 3),
        objects,
        escapeRouteCount: escapeRoutesForMap.length,
        hospitalReady: Boolean(hospitalIntel?.hospital || currentProject?.nearestHospital),
        screenshotSaved: Boolean(
          currentProject?.hospitalRouteScreenshotUrl ||
            currentProject?.siteMapUrl ||
            currentProject?.siteMapPngDataUrl
        ),
      }),
    [
      siteGeoStatus.source,
      projectBoundaryRing,
      objects,
      escapeRoutesForMap.length,
      hospitalIntel?.hospital,
      currentProject?.nearestHospital,
      currentProject?.hospitalRouteScreenshotUrl,
      currentProject?.siteMapUrl,
      currentProject?.siteMapPngDataUrl,
    ]
  );

  const geoPreviewPoints = useMemo(() => {
    const out = [];
    for (const row of visibleObjects) {
      if (row.placement === "map" && Number.isFinite(row.geoLat) && Number.isFinite(row.geoLng)) {
        const { lat, lng } = getObjectLatLng(row, geoAnchor, effectiveAffine);
        out.push({
          id: row.id,
          x: row.x,
          y: row.y,
          lat,
          lng,
          title: drawingObjectLabel(row),
          color: drawingObjectTypeMeta(row.type).color,
        });
        continue;
      }
      if (selectedPlan && (!row.planId || row.planId === selectedPlan.id)) {
        const { lat, lng } = getObjectLatLng(row, geoAnchor, effectiveAffine);
        out.push({
          id: row.id,
          x: row.x,
          y: row.y,
          lat,
          lng,
          title: drawingObjectLabel(row),
          color: drawingObjectTypeMeta(row.type).color,
        });
      }
    }
    return out;
  }, [visibleObjects, selectedPlan, geoAnchor, effectiveAffine]);

  const highPointWarnedRef = useRef(false);
  useEffect(() => {
    const n = Math.max(geoPreviewPoints.length, mapObjectsForCanvas.length);
    if (n >= 100 && !highPointWarnedRef.current) {
      highPointWarnedRef.current = true;
      setToast("Many points — the map clusters markers; exports may be large.");
    }
    if (n < 40) highPointWarnedRef.current = false;
  }, [geoPreviewPoints.length, mapObjectsForCanvas.length]);

  const onGeoMapSelect = useCallback((id) => {
    setSelectedIds([id]);
  }, []);

  const addMapObject = useCallback(
    (lat, lng) => {
      if (mapClickOverrideRef.current?.(lat, lng)) return;
      if (!projectId || tool !== "place") return;
      pushHistory();
      const next = buildProjectDrawingObject({
        projectId,
        planId: "",
        type: objectType,
        label: "",
        x: 50,
        y: 50,
        placement: "map",
        geoLat: lat,
        geoLng: lng,
      });
      setRows((prev) => [next, ...prev].slice(0, 1500));
      setSelectedIds([next.id]);
    },
    [projectId, objectType, pushHistory, tool]
  );

  const addDraftPointPlan = useCallback(
    (x, y) => {
      if (tool !== "boundary" && tool !== "area" && tool !== "route") return;
      setDraftRing((prev) => [...prev, { x, y }]);
    },
    [tool]
  );

  const addDraftPointMap = useCallback(
    (lat, lng) => {
      if (tool !== "boundary" && tool !== "area" && tool !== "route") return;
      setDraftRing((prev) => [...prev, { geoLat: lat, geoLng: lng }]);
    },
    [tool]
  );

  const undoDraftPoint = useCallback(() => {
    setDraftRing((prev) => prev.slice(0, -1));
  }, []);

  const cancelDraftRing = useCallback(() => {
    setDraftRing([]);
  }, []);

  const finishSiteBoundary = useCallback(() => {
    if (!projectId || !currentProject || draftRing.length < 3) {
      window.alert("Add at least 3 points to close the site boundary.");
      return;
    }
    const placement = workSurface === "map" ? "map" : "plan";
    const patch = projectBoundaryFromDraftRing(draftRing, placement, geoAnchor, effectiveAffine, {
      name: currentProject.boundaryName || "Drawn site boundary",
    });
    if (!patch) {
      window.alert("Could not build boundary — check anchor / calibration.");
      return;
    }
    const centroid = patch.boundaryPoints.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat / patch.boundaryPoints.length, lng: acc.lng + p.lng / patch.boundaryPoints.length }),
      { lat: 0, lng: 0 }
    );
    updateProjectRecord({
      ...currentProject,
      ...patch,
      lat: String(centroid.lat),
      lng: String(centroid.lng),
    });
    setDraftRing([]);
    setTool("select");
    setToast(`Site boundary saved (${patch.boundaryPoints.length} points)`);
  }, [projectId, currentProject, draftRing, workSurface, geoAnchor, effectiveAffine, updateProjectRecord]);

  const finishAreaPolygon = useCallback(() => {
    if (!projectId || draftRing.length < 3) {
      window.alert("Add at least 3 points to close the area.");
      return;
    }
    pushHistory();
    const placement = workSurface === "map" ? "map" : "plan";
    const kindMeta = pdeAreaKindMeta(areaKind);
    const ring =
      placement === "map"
        ? draftRing.map((p) => ({ geoLat: p.geoLat, geoLng: p.geoLng }))
        : draftRing.map((p) => ({ x: p.x, y: p.y }));
    let cx = 50;
    let cy = 50;
    let geoLat = null;
    let geoLng = null;
    if (placement === "map") {
      const sLat = ring.reduce((s, p) => s + p.geoLat, 0);
      const sLng = ring.reduce((s, p) => s + p.geoLng, 0);
      geoLat = sLat / ring.length;
      geoLng = sLng / ring.length;
    } else {
      cx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
      cy = ring.reduce((s, p) => s + p.y, 0) / ring.length;
    }
    const next = buildProjectDrawingObject({
      projectId,
      planId: placement === "plan" ? planId : "",
      type: "site_area",
      label: kindMeta.label,
      x: cx,
      y: cy,
      placement,
      geometry: "polygon",
      ring,
      geoLat,
      geoLng,
      meta: { areaKind, notes: "" },
    });
    setRows((prev) => [next, ...prev].slice(0, 1500));
    setSelectedIds([next.id]);
    setDraftRing([]);
    setTool("select");
    setToast(`${kindMeta.label} saved`);
  }, [projectId, draftRing, workSurface, areaKind, planId, pushHistory]);

  const finishEscapeRoute = useCallback(() => {
    if (!projectId || !currentProject || draftRing.length < 2) {
      window.alert("Add at least 2 points to save an escape route.");
      return;
    }
    const points =
      workSurface === "map"
        ? draftRing.map((p) => ({ lat: p.geoLat, lng: p.geoLng }))
        : draftRing.map((p) => {
            const { lat, lng } = getObjectLatLng({ x: p.x, y: p.y }, geoAnchor, effectiveAffine);
            return { lat, lng };
          });
    const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
    const next = {
      id: `er_${Date.now()}`,
      name: `Escape route ${routes.length + 1}`,
      points,
    };
    updateProjectRecord({
      ...currentProject,
      mapEscapeRoutes: [...routes, next].slice(0, 24),
    });
    setDraftRing([]);
    setTool("select");
    setHighlightEscapeRouteId(next.id);
    setEscapeRouteAppendMode(false);
    setEscapeRoutePointIndex(-1);
    setToast(`Escape route saved (${points.length} points) — drag handles to adjust`);
  }, [projectId, currentProject, draftRing, workSurface, geoAnchor, effectiveAffine, updateProjectRecord]);

  const renameEscapeRoute = useCallback(
    (routeId, name) => {
      if (!currentProject) return;
      const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
      updateProjectRecord({
        ...currentProject,
        mapEscapeRoutes: routes.map((r) => (r.id === routeId ? { ...r, name: String(name || "").slice(0, 80) } : r)),
      });
    },
    [currentProject, updateProjectRecord]
  );

  const deleteEscapeRoute = useCallback(
    (routeId) => {
      if (!currentProject) return;
      const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
      if (!routes.some((r) => r.id === routeId)) return;
      if (!window.confirm("Delete this escape route from the project?")) return;
      updateProjectRecord({
        ...currentProject,
        mapEscapeRoutes: routes.filter((r) => r.id !== routeId),
      });
      setHighlightEscapeRouteId((cur) => (cur === routeId ? "" : cur));
      setToast("Escape route removed");
    },
    [currentProject, updateProjectRecord]
  );

  const zoomEscapeRoute = useCallback((route) => {
    if (!route?.points?.length) return;
    setWorkSurface("map");
    setTool("select");
    setHighlightEscapeRouteId(route.id || "");
    window.setTimeout(() => mapCanvasRef.current?.fitEscapeRoute(route.points), 180);
  }, []);

  const updateEscapeRoutePoints = useCallback(
    (routeId, points) => {
      if (!currentProject || !routeId || !Array.isArray(points)) return;
      const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
      updateProjectRecord({
        ...currentProject,
        mapEscapeRoutes: routes.map((r) =>
          r.id === routeId
            ? {
                ...r,
                points: points
                  .map((p) => ({
                    lat: Number(p.lat),
                    lng: Number(p.lng),
                  }))
                  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
              }
            : r
        ),
      });
    },
    [currentProject, updateProjectRecord]
  );

  const insertEscapeRoutePoint = useCallback(
    (routeId, insertIndex, lat, lng) => {
      if (!currentProject || !routeId || insertIndex < 1) return;
      const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
      const route = routes.find((r) => r.id === routeId);
      if (!route) return;
      const points = [...(route.points || [])];
      const idx = Math.min(Math.max(insertIndex, 1), points.length);
      points.splice(idx, 0, { lat, lng });
      updateEscapeRoutePoints(routeId, points);
      setEscapeRoutePointIndex(idx);
      setToast("Point inserted on route");
    },
    [currentProject, updateEscapeRoutePoints]
  );

  const appendEscapeRoutePoint = useCallback(
    (lat, lng) => {
      if (!currentProject || !highlightEscapeRouteId) return;
      const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
      const route = routes.find((r) => r.id === highlightEscapeRouteId);
      if (!route) return;
      const points = [...(route.points || []), { lat, lng }];
      updateEscapeRoutePoints(highlightEscapeRouteId, points);
      setEscapeRoutePointIndex(points.length - 1);
      setToast("Point added to escape route");
    },
    [currentProject, highlightEscapeRouteId, updateEscapeRoutePoints]
  );

  const removeEscapeRoutePointAt = useCallback(
    (routeId, pointIndex) => {
      if (!currentProject || !routeId || pointIndex < 0) return;
      const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
      const route = routes.find((r) => r.id === routeId);
      if (!route || (route.points || []).length <= 2) {
        setToast("Route needs at least 2 points");
        return;
      }
      const points = (route.points || []).filter((_, i) => i !== pointIndex);
      updateEscapeRoutePoints(routeId, points);
      setEscapeRoutePointIndex(Math.min(pointIndex, points.length - 1));
      setToast("Route point removed");
    },
    [currentProject, updateEscapeRoutePoints]
  );

  const duplicateEscapeRoute = useCallback(
    (routeId) => {
      if (!currentProject) return;
      const routes = Array.isArray(currentProject.mapEscapeRoutes) ? currentProject.mapEscapeRoutes : [];
      const source = routes.find((r) => r.id === routeId);
      if (!source?.points?.length) return;
      const copy = {
        id: `er_${Date.now()}`,
        name: `${source.name || "Escape route"} (copy)`,
        points: source.points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
      };
      updateProjectRecord({
        ...currentProject,
        mapEscapeRoutes: [...routes, copy].slice(0, 24),
      });
      setHighlightEscapeRouteId(copy.id);
      setToast("Escape route duplicated");
    },
    [currentProject, updateProjectRecord]
  );

  useEffect(() => {
    highlightEscapeRouteIdRef.current = highlightEscapeRouteId;
    escapeRoutePointIndexRef.current = escapeRoutePointIndex;
  }, [highlightEscapeRouteId, escapeRoutePointIndex]);

  useEffect(() => {
    if (escapeRouteAppendMode && highlightEscapeRouteId) {
      mapClickOverrideRef.current = (lat, lng) => {
        appendEscapeRoutePoint(lat, lng);
        return true;
      };
      return;
    }
    mapClickOverrideRef.current = null;
  }, [escapeRouteAppendMode, highlightEscapeRouteId, appendEscapeRoutePoint]);

  const handleMapLayerChange = useCallback((layerId, enabled) => {
    setMapLayers((prev) => ({ ...prev, [layerId]: enabled }));
  }, []);

  const exportSitePack = useCallback(async () => {
    if (!projectId || !currentProject) return;
    setSitePackBusy(true);
    try {
      const permitRef = String(exportPermitRef || "").trim();
      const manifest = buildSitePackManifest({
        project: currentProject,
        readiness: siteReadiness,
        objects,
        escapeRoutes: escapeRoutesForMap,
        permitRef,
      });
      triggerBlobDownload(
        new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
        `site-pack-${projectId}.json`
      );

      const kml = buildSitePackKml({
        projectId,
        planName: selectedPlan?.name || "",
        objects,
        anchor: geoAnchor,
        affine: effectiveAffine,
        permitRef,
        boundaryPoints: currentProject.boundaryPoints || [],
        boundaryName: currentProject.boundaryName || "",
        escapeRoutes: escapeRoutesForMap,
      });
      triggerBlobDownload(new Blob([kml], { type: "application/vnd.google-earth.kml+xml" }), `site-pack-${projectId}.kml`);

      if (workSurface === "map") {
        const el = document.getElementById("pde-map-capture-root");
        if (el) {
          await new Promise((r) => window.setTimeout(r, 250));
          const blob = await captureElementPngBlob(el);
          if (blob) {
            triggerBlobDownload(blob, `site-pack-map-${projectId}.png`);
          }
        }
      }

      setToast("Site pack downloaded — JSON, KML" + (workSurface === "map" ? " and map PNG" : ""));
    } catch {
      setToast("Site pack export failed");
    } finally {
      setSitePackBusy(false);
    }
  }, [
    projectId,
    currentProject,
    exportPermitRef,
    siteReadiness,
    objects,
    escapeRoutesForMap,
    selectedPlan?.name,
    geoAnchor,
    effectiveAffine,
    workSurface,
  ]);

  const onMapSelectIds = useCallback((id, additive) => {
    if (additive) {
      setSelectedIds((prev) => {
        const s = new Set(prev);
        if (s.has(id)) s.delete(id);
        else s.add(id);
        return [...s];
      });
    } else {
      setSelectedIds([id]);
    }
  }, []);

  const onMapMarkerDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const onBatchGeoUpdate = useCallback((updates) => {
    if (!updates?.length) return;
    const at = new Date().toISOString();
    setRows((prev) => {
      const byId = new Map(updates.map((u) => [u.id, u]));
      return prev.map((row) => {
        const u = byId.get(row.id);
        if (!u) return row;
        return { ...row, geoLat: u.geoLat, geoLng: u.geoLng, updatedAt: at };
      });
    });
  }, []);

  const captureMapPng = useCallback(async () => {
    const el = document.getElementById("pde-map-capture-root");
    if (!el) {
      setToast("Map not ready");
      return;
    }
    const previousBasemap = mapBasemap;
    // Satellite tiles often taint the canvas even with crossOrigin — force OSM for export.
    if (mapBasemap === "satellite") {
      setMapBasemap("streets");
      await new Promise((r) => window.setTimeout(r, 450));
    }
    try {
      const blob = await captureElementPngBlob(el);
      if (!blob) {
        setToast("PNG blob failed");
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `project-map-${projectId || "export"}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      let cloudNote = "";
      if (r2Enabled && projectId && currentProject) {
        const filename = `project-map-${projectId}.png`;
        const publicUrl = await uploadBlobToOrgR2(blob, filename);
        if (publicUrl) {
          updateProjectRecord({
            ...currentProject,
            siteMapUrl: publicUrl,
            siteMapCapturedAt: new Date().toISOString(),
          });
          cloudNote = " — link saved on project for RAMS";
        }
      }
      setToast(`PNG saved${previousBasemap === "satellite" ? " (streets basemap)" : ""}${cloudNote}`);
    } catch {
      setToast("PNG failed (tile CORS) — switch to Streets basemap, or use Win+Shift+S / export KML");
    } finally {
      if (previousBasemap === "satellite") setMapBasemap("satellite");
    }
  }, [projectId, currentProject, r2Enabled, uploadBlobToOrgR2, updateProjectRecord, mapBasemap]);

  const runReadinessFix = useCallback(
    (checkId) => {
      switch (checkId) {
        case "site":
          reapplyProjectSiteAnchor();
          break;
        case "boundary":
          setWorkSurface("map");
          setTool("boundary");
          setToast("Click map corners to draw site boundary");
          break;
        case "muster":
          setWorkSurface("map");
          setObjectType("master_point");
          setTool("place");
          setToast("Click map to place muster point");
          break;
        case "firstAid":
          setWorkSurface("map");
          setObjectType("first_aid");
          setTool("place");
          setToast("Click map to place first aid");
          break;
        case "escapeRoute":
          setWorkSurface("map");
          setTool("route");
          setToast("Click waypoints, then Finish route");
          break;
        case "hospital":
          fetchHospitalRoute();
          break;
        case "screenshot":
          captureMapPng();
          break;
        default:
          break;
      }
    },
    [reapplyProjectSiteAnchor, fetchHospitalRoute, captureMapPng]
  );

  const dismissPdeOnboarding = useCallback(() => {
    try {
      sessionStorage.setItem("pde_onboarding_v1", "1");
    } catch {
      /* ignore */
    }
    setShowPdeOnboarding(false);
  }, []);

  const clearMapObjects = useCallback(() => {
    if (!projectId) return;
    const mapRows = rowsRef.current.filter((r) => r.projectId === projectId && r.placement === "map");
    if (mapRows.length === 0) {
      window.alert("No map-placed objects to remove.");
      return;
    }
    if (!window.confirm(`Remove ${mapRows.length} map-placed object(s)?`)) return;
    pushHistory();
    const rm = new Set(mapRows.map((r) => r.id));
    setRows((prev) => prev.filter((r) => !rm.has(r.id)));
    setSelectedIds((sel) => sel.filter((id) => !rm.has(id)));
  }, [projectId, pushHistory]);

  const bumpPlanZoom = useCallback((delta) => {
    setMapZoom((z) => clamp(Number((z + delta).toFixed(2)), 0.5, 3));
  }, []);

  const clientToPercent = (clientX, clientY) => {
    const el = mapContentRef.current;
    if (!el) return { x: 50, y: 50 };
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 50, y: 50 };
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    if (gridStep) {
      x = snapValue(x, gridStep);
      y = snapValue(y, gridStep);
    }
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const onPlanBackgroundPointerDown = (e) => {
    if (tool === "pan") return;
    if (e.target !== e.currentTarget && e.target.tagName !== "IMG") return;
    if (!selectedPlan || String(selectedPlan.mimeType || "").toLowerCase().includes("pdf")) return;
    const { x, y } = clientToPercent(e.clientX, e.clientY);
    if (tool === "boundary" || tool === "area" || tool === "route") {
      addDraftPointPlan(x, y);
      return;
    }
    if (tool !== "place") return;
    addObject({ x, y, planId: selectedPlan.id });
  };

  const onViewportPointerDown = (e) => {
    if (tool !== "pan") return;
    const vp = viewportRef.current;
    if (!vp) return;
    panPointer.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      sl: vp.scrollLeft,
      st: vp.scrollTop,
    };
    vp.setPointerCapture?.(e.pointerId);
    const onMove = (ev) => {
      const st = panPointer.current;
      if (!st || ev.pointerId !== st.id) return;
      const dx = ev.clientX - st.startX;
      const dy = ev.clientY - st.startY;
      vp.scrollLeft = st.sl - dx;
      vp.scrollTop = st.st - dy;
    };
    const onUp = (ev) => {
      if (ev.pointerId !== panPointer.current?.id) return;
      panPointer.current = null;
      vp.releasePointerCapture?.(ev.pointerId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };

  const onMarkerPointerDown = (e, row) => {
    e.stopPropagation();
    const additive = e.ctrlKey || e.metaKey;
    const cur = selectedIdsRef.current;
    let idsToMove;

    if (additive) {
      const s = new Set(cur);
      if (s.has(row.id)) s.delete(row.id);
      else s.add(row.id);
      const nextSel = [...s];
      setSelectedIds(nextSel);
      if (!nextSel.includes(row.id)) return;
      idsToMove = nextSel;
    } else if (cur.length > 1 && cur.includes(row.id)) {
      idsToMove = cur;
    } else {
      setSelectedIds([row.id]);
      idsToMove = [row.id];
    }

    // Place-only / tablet: select markers without starting a drag (avoids accidental moves)
    if (placeOnly || tool === "place" || tool === "boundary" || tool === "area" || tool === "route") {
      return;
    }

    const wrap = mapContentRef.current;
    if (!wrap) return;
    pushHistory();
    const startById = {};
    for (const id of idsToMove) {
      const r = rowsRef.current.find((x) => x.id === id);
      if (r) startById[id] = { x: r.x, y: r.y };
    }
    const ids = idsToMove.filter((id) => startById[id]);
    if (ids.length === 0) return;
    dragState.current = {
      ids,
      startById,
      origin: clientToPercent(e.clientX, e.clientY),
    };
    const onMove = (ev) => {
      const st = dragState.current;
      if (!st || !st.ids) return;
      const pos = clientToPercent(ev.clientX, ev.clientY);
      const dx = pos.x - st.origin.x;
      const dy = pos.y - st.origin.y;
      for (const id of st.ids) {
        const s0 = st.startById[id];
        if (!s0) continue;
        upsertObject(id, {
          x: clamp(s0.x + dx, 0, 100),
          y: clamp(s0.y + dy, 0, 100),
        });
      }
    };
    const onUp = () => {
      dragState.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };

  useEffect(() => {
    if (!primaryId || !listItemRefs.current[primaryId]) return;
    listItemRefs.current[primaryId]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [primaryId]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (e.key === "Delete" || e.key === "Backspace") {
        if (typing) return;
        if (
          highlightEscapeRouteIdRef.current &&
          escapeRoutePointIndexRef.current >= 0
        ) {
          e.preventDefault();
          removeEscapeRoutePointAt(
            highlightEscapeRouteIdRef.current,
            escapeRoutePointIndexRef.current
          );
          return;
        }
        const ids = selectedIdsRef.current;
        if (ids.length === 0) return;
        e.preventDefault();
        if (ids.length === 1) removeObject(ids[0], true);
        else removeSelectedBulk(true);
        return;
      }
      const ids = selectedIdsRef.current;
      if (ids.length === 0 || typing) return;
      const step = e.shiftKey ? 2 : 0.5;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (!dx && !dy) return;
      e.preventDefault();
      pushHistory();
      for (const id of ids) {
        const row = rowsRef.current.find((r) => r.id === id);
        if (!row) continue;
        if (isMapPlacement(row) && Number.isFinite(row.geoLat) && Number.isFinite(row.geoLng)) {
          const gStep = e.shiftKey ? 0.00012 : 0.000015;
          let dLat = 0;
          let dLng = 0;
          if (e.key === "ArrowLeft") dLng = -gStep;
          if (e.key === "ArrowRight") dLng = gStep;
          if (e.key === "ArrowUp") dLat = gStep;
          if (e.key === "ArrowDown") dLat = -gStep;
          upsertObject(id, {
            geoLat: clamp(row.geoLat + dLat, -85, 85),
            geoLng: clamp(row.geoLng + dLng, -180, 180),
          });
          continue;
        }
        upsertObject(id, {
          x: clamp(row.x + dx, 0, 100),
          y: clamp(row.y + dy, 0, 100),
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeObject, removeSelectedBulk, pushHistory, gridStep, upsertObject, removeEscapeRoutePointAt]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || workSurface !== "plan") return undefined;
    const fn = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setMapZoom((z) => clamp(Number((z - e.deltaY * 0.001).toFixed(2)), 0.5, 3));
    };
    vp.addEventListener("wheel", fn, { passive: false });
    return () => vp.removeEventListener("wheel", fn);
  }, [selectedPlan?.id, tool, workSurface]);

  // Pinch-to-zoom on plan viewport (iPhone / Windows tablets)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || workSurface !== "plan") return undefined;
    const pointers = new Map();
    let lastDist = null;
    const onDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        vp.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size !== 2) return;
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastDist != null && lastDist > 0) {
        const scale = dist / lastDist;
        setMapZoom((z) => clamp(Number((z * scale).toFixed(2)), 0.5, 3));
      }
      lastDist = dist;
      e.preventDefault();
    };
    const onUp = (e) => {
      pointers.delete(e.pointerId);
      try {
        vp.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      if (pointers.size < 2) lastDist = null;
    };
    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove, { passive: false });
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onUp);
    return () => {
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
    };
  }, [selectedPlan?.id, workSurface]);

  const fitView = () => {
    setMapZoom(1);
    const vp = viewportRef.current;
    if (vp) {
      vp.scrollLeft = 0;
      vp.scrollTop = 0;
    }
  };

  const centerPlanOnSelection = useCallback(() => {
    const pid = selectedIdsRef.current[selectedIdsRef.current.length - 1];
    const row = pid ? rowsRef.current.find((r) => r.id === pid) : null;
    if (!row) return;
    if (isMapPlacement(row) && Number.isFinite(row.geoLat) && Number.isFinite(row.geoLng)) {
      mapCanvasRef.current?.flyTo(row.geoLat, row.geoLng, 18);
      return;
    }
    const vp = viewportRef.current;
    const mc = mapContentRef.current;
    if (!vp || !mc) return;
    const cw = mc.offsetWidth;
    const ch = mc.offsetHeight;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const targetX = (row.x / 100) * cw - vw / 2;
    const targetY = (row.y / 100) * ch - vh / 2;
    vp.scrollLeft = clamp(targetX, 0, Math.max(0, cw - vw));
    vp.scrollTop = clamp(targetY, 0, Math.max(0, ch - vh));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
          e.preventDefault();
          return;
        }
        if (!typing && draftRing.length > 0) {
          setDraftRing([]);
          e.preventDefault();
          return;
        }
        if (!typing && escapeRouteAppendMode) {
          setEscapeRouteAppendMode(false);
          e.preventDefault();
          return;
        }
        if (!typing && highlightEscapeRouteIdRef.current) {
          setHighlightEscapeRouteId("");
          setEscapeRoutePointIndex(-1);
          e.preventDefault();
          return;
        }
        if (!typing && selectedIdsRef.current.length > 0) {
          setSelectedIds([]);
          e.preventDefault();
        }
        return;
      }
      if (
        (e.key === "Enter" || e.key === " ") &&
        !typing &&
        draftRing.length >= (tool === "route" ? 2 : 3) &&
        (tool === "boundary" || tool === "area" || tool === "route")
      ) {
        e.preventDefault();
        if (tool === "boundary") finishSiteBoundary();
        else if (tool === "area") finishAreaPolygon();
        else finishEscapeRoute();
        return;
      }
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        !typing &&
        draftRing.length > 0 &&
        (tool === "boundary" || tool === "area" || tool === "route")
      ) {
        e.preventDefault();
        undoDraftPoint();
        return;
      }
      if ((e.key === "?" || (e.code === "Slash" && e.shiftKey)) && !typing) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !typing && selectedIdsRef.current.length > 0) {
        e.preventDefault();
        copySelectedCoords();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (
        !typing &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4" || e.key === "5" || e.key === "6")
      ) {
        e.preventDefault();
        if (e.key === "1") setTool("place");
        if (e.key === "2") setTool("select");
        if (e.key === "3") setTool("pan");
        if (e.key === "4") setTool("boundary");
        if (e.key === "5") setTool("area");
        if (e.key === "6") setTool("route");
      }
      if (e.key === "Home" && !typing && selectedIdsRef.current.length > 0) {
        e.preventDefault();
        centerPlanOnSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    copySelectedCoords,
    showShortcuts,
    undo,
    redo,
    centerPlanOnSelection,
    draftRing.length,
    tool,
    finishSiteBoundary,
    finishAreaPolygon,
    finishEscapeRoute,
    undoDraftPoint,
    escapeRouteAppendMode,
    removeEscapeRoutePointAt,
  ]);

  return (
    <div style={{ fontFamily: "DM Sans, system-ui, sans-serif", padding: "1.25rem 0", fontSize: 14, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="PDE"
        title="Project drawing editor"
        lead="Place and edit location objects on plan overlays, export to JSON / GeoJSON / KML / GPX, and reuse them when you pick sites in permits."
        right={
          <button type="button" style={ss.btn} onClick={() => openWorkspaceView({ viewId: "permits" })}>
            Open permits
          </button>
        }
      />

      {showPdeOnboarding ? (
        <div
          className="app-surface-card"
          style={{
            ...ss.card,
            marginBottom: 12,
            padding: 14,
            background: "var(--color-background-secondary,#f0fdfa)",
            border: "1px solid #99f6e4",
            ...pdeUi.cardAccent,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Quick start</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.65, color: "var(--color-text-primary)" }}>
            <li>
              Choose a <strong>project</strong>, then <strong>Plan (PDF / image)</strong> to draw on an uploaded plan, or <strong>Map (GPS)</strong> when you have no drawing.
            </li>
            <li>
              Use <strong>Place</strong> for points (fire exit, extinguisher, muster, parking, first aid…) or <strong>Boundary</strong> / <strong>Area zone</strong> to draw closed polygons on plan or map.
            </li>
            <li>
              Use tool <strong>Place</strong> and click the plan or map to add markers. Draw <strong>site boundary</strong> with the Boundary tool — it saves to the project like KML import.
            </li>
            <li>
              Export <strong>KML / GPX / GeoJSON</strong>, import GPX/KML waypoints, or <strong>Save map PNG</strong> for RAMS and permits.
            </li>
          </ol>
          <button type="button" style={{ ...ss.btn, marginTop: 10, ...pdeUi.btnCompact }} onClick={dismissPdeOnboarding}>
            Got it
          </button>
        </div>
      ) : null}

      <div className="app-surface-card pde-workspace-card" style={{ ...ss.card, marginBottom: 12, ...pdeUi.cardAccent }}>
        {projectId ? (
          <ProjectDrawingSmartBar
            project={currentProject}
            workSurface={workSurface}
            siteGeoStatus={siteGeoStatus}
            hasBoundary={Boolean(projectBoundaryRing?.length >= 3)}
            mapPointCount={mapObjectsForCanvas.length}
            planPointCount={planObjectsForMap.length}
            areaCount={(workSurface === "map" ? mapAreaObjects : planAreaObjects).length}
            escapeRouteCount={escapeRoutesForMap.length}
            hospitalReady={Boolean(hospitalIntel?.hospital || currentProject?.nearestHospital)}
            screenshotSaved={Boolean(
              currentProject?.hospitalRouteScreenshotUrl ||
                currentProject?.siteMapUrl ||
                currentProject?.siteMapPngDataUrl
            )}
            readiness={siteReadiness}
            onCentreSite={reapplyProjectSiteAnchor}
            onFetchHospital={fetchHospitalRoute}
            onSwitchMap={() => setWorkSurface("map")}
            onExportSitePack={exportSitePack}
            onReadinessFix={runReadinessFix}
            sitePackBusy={sitePackBusy}
            hospitalBusy={hospitalBusy}
          />
        ) : null}

        <div className="pde-section pde-section--project">
          <div className="pde-section__label">Project &amp; objects</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-project">Project</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSelectedIds([]);
              }}
              style={ss.inp}
             id="project-drawing-project">
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-plan-overlay">Plan overlay</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={ss.inp} id="project-drawing-plan-overlay">
              <option value="">No plan selected</option>
              {plansForCurrentProject.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-object-type-new">Object type (new)</label>
            <select value={objectType} onChange={(e) => setObjectType(e.target.value)} style={ss.inp} id="project-drawing-object-type-new">
              {drawingObjectCategories().map((cat) => (
                <optgroup key={cat.id} label={cat.label}>
                  {PROJECT_DRAWING_OBJECT_TYPES.filter((t) => t.category === cat.id && !t.isArea).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-visible-on-map">Visible on map</label>
            <select value={visibleType} onChange={(e) => setVisibleType(e.target.value)} style={ss.inp} id="project-drawing-visible-on-map">
              <option value="all">All object types</option>
              {PROJECT_DRAWING_OBJECT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {plansForCurrentProject.length > 1 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Plans:</span>
            {plansForCurrentProject.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                style={{
                  ...ss.btn,
                  fontSize: 11,
                  padding: "4px 10px",
                  background: planId === p.id ? "var(--color-accent-muted,#ccfbf1)" : undefined,
                  borderColor: planId === p.id ? "#0d9488" : undefined,
                }}
              >
                {p.name || "Plan"}
              </button>
            ))}
          </div>
        ) : null}

        {projectId ? (
          <div style={{ marginTop: 16 }}>
            <ProjectSitePlanPanel
              projectId={projectId}
              project={currentProject}
              onProjectUpdate={updateProjectRecord}
              selectedPlanId={planId}
              onSelectPlanId={setPlanId}
              onPlansChanged={refreshProjectPlans}
            />
          </div>
        ) : null}
        </div>

        {projectId ? (
          <ProjectDrawingQuickChips
            disabled={!projectId}
            activeType={objectType}
            onPick={(type) => {
              setObjectType(type);
              setTool("place");
            }}
          />
        ) : null}

        <div className="pde-section pde-section--tools" style={{ marginTop: 12 }}>
          <div className="pde-section__label">Surface &amp; tools</div>
        <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
          <div style={pdeUi.toolWrap} role="tablist" aria-label="Work surface">
            <button
              type="button"
              role="tab"
              aria-selected={workSurface === "plan"}
              disabled={!canUsePlanSurface}
              style={{ ...pdeUi.toolBtn(workSurface === "plan"), opacity: canUsePlanSurface ? 1 : 0.5 }}
              onClick={() => canUsePlanSurface && setWorkSurface("plan")}
              title={!canUsePlanSurface ? "Upload a plan below (PDF or JPG)" : "Work on PDF or image overlay"}
            >
              Plan (PDF / image)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workSurface === "map"}
              style={pdeUi.toolBtn(workSurface === "map")}
              onClick={() => setWorkSurface("map")}
              title="Place points on the map when you have no plan"
            >
              Map (GPS)
            </button>
          </div>
          {workSurface === "map" ? (
            <>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="pde-basemap" checked={mapBasemap === "streets"} onChange={() => setMapBasemap("streets")} />
                Streets
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="pde-basemap" checked={mapBasemap === "satellite"} onChange={() => setMapBasemap("satellite")} />
                Satellite
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={showMapLegend} onChange={(e) => setShowMapLegend(e.target.checked)} />
                Legend on PNG
              </label>
              <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} onClick={captureMapPng} disabled={!projectId}>
                Save map PNG
              </button>
              {r2Enabled ? (
                <button
                  type="button"
                  style={{ ...ss.btn, ...pdeUi.btnCompact }}
                  onClick={() => uploadMapPngToR2()}
                  disabled={!projectId || r2Busy}
                  title="Save capture to cloud library (same list as Documents)"
                >
                  {r2Busy ? "Uploading…" : "Upload PNG to cloud"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        </div>

        <div className="pde-section pde-section--actions" style={{ marginTop: 12 }}>
          <div className="pde-section__label">Tools &amp; actions</div>
        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", alignItems: "center", rowGap: 10 }}>
            <div className="pde-tool-wrap" style={pdeUi.toolWrap} role="tablist" aria-label="Drawing tool">
              <button
                type="button"
                className="pde-tool-btn"
                role="tab"
                aria-selected={tool === "place"}
                style={pdeUi.toolBtn(tool === "place")}
                onClick={() => setTool("place")}
              >
                Place
              </button>
              <button
                type="button"
                className="pde-tool-btn"
                role="tab"
                aria-selected={tool === "boundary"}
                style={pdeUi.toolBtn(tool === "boundary")}
                onClick={() => setTool("boundary")}
                title="Draw closed site boundary polygon (saved to project)"
              >
                Boundary
              </button>
              <button
                type="button"
                className="pde-tool-btn"
                role="tab"
                aria-selected={tool === "area"}
                style={pdeUi.toolBtn(tool === "area")}
                onClick={() => setTool("area")}
                title="Draw zone / parking / exclusion area polygon"
              >
                Area zone
              </button>
              <button
                type="button"
                className="pde-tool-btn"
                role="tab"
                aria-selected={tool === "route"}
                style={pdeUi.toolBtn(tool === "route")}
                onClick={() => setTool("route")}
                title="Draw escape / evacuation route (saved to project)"
              >
                Escape route
              </button>
              <button
                type="button"
                className="pde-tool-btn"
                role="tab"
                aria-selected={tool === "select"}
                style={pdeUi.toolBtn(tool === "select")}
                onClick={() => setTool("select")}
              >
                Select
              </button>
              <button
                type="button"
                className="pde-tool-btn"
                role="tab"
                aria-selected={tool === "pan"}
                style={pdeUi.toolBtn(tool === "pan")}
                onClick={() => setTool("pan")}
              >
                Pan
              </button>
            </div>
          {tool === "area" ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              Area type
              <select value={areaKind} onChange={(e) => setAreaKind(e.target.value)} style={{ ...ss.inp, width: 200, margin: 0 }}>
                {PDE_AREA_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={placeOnly} onChange={(e) => setPlaceOnly(e.target.checked)} />
            Place only (no drag)
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={snapGrid} onChange={(e) => setSnapGrid(e.target.checked)} />
            Snap 5% grid
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={showMapLabels} onChange={(e) => setShowMapLabels(e.target.checked)} />
            Labels on map
          </label>
          <span style={pdeUi.toolHint}>
            Keys <kbd style={{ fontFamily: "inherit", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>1</kbd>{" "}
            <kbd style={{ fontFamily: "inherit", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>2</kbd>{" "}
            <kbd style={{ fontFamily: "inherit", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>3</kbd>{" "}
            <kbd style={{ fontFamily: "inherit", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>4</kbd>{" "}
            <kbd style={{ fontFamily: "inherit", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>5</kbd>{" "}
            <kbd style={{ fontFamily: "inherit", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>6</kbd> · Enter finish shape
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center", rowGap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              style={ss.btnP}
              disabled={!projectId}
              onClick={() => {
                if (workSurface === "map") addMapObject(geoAnchor.lat, geoAnchor.lng);
                else addObject();
              }}
            >
              {workSurface === "map" ? "Add at map center" : "Add at center"}
            </button>
            <button type="button" style={ss.btn} disabled={undoStack.current.length === 0} onClick={undo} title="Undo last change">
              Undo
            </button>
            <button type="button" style={ss.btn} disabled={redoStack.current.length === 0} onClick={redo} title="Redo">
              Redo
            </button>
            <button
              type="button"
              style={ss.btn}
              disabled={!primaryId}
              onClick={() => {
                const row = objects.find((o) => o.id === primaryId);
                if (row) duplicateObject(row);
              }}
            >
              Duplicate primary
            </button>
          </div>
          <div style={pdeUi.toolbarDivider} aria-hidden />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {workSurface === "plan" ? (
              <button
                type="button"
                style={ss.btn}
                disabled={!projectId || !planId || planObjectsForMap.length === 0}
                onClick={() => setSelectedIds(planObjectsForMap.map((r) => r.id))}
                title="Select every visible point on this plan"
              >
                Select all on plan
              </button>
            ) : (
              <button
                type="button"
                style={ss.btn}
                disabled={!projectId || mapObjectsForCanvas.length === 0}
                onClick={() => setSelectedIds(mapObjectsForCanvas.map((r) => r.id))}
                title="Select all points placed on the map"
              >
                Select all on map
              </button>
            )}
            <button type="button" style={ss.btn} disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>
              Clear selection
            </button>
            <button type="button" style={ss.btn} disabled={selectedIds.length === 0} onClick={() => copySelectedCoords()} title="Ctrl+C — all selected">
              Copy coords
            </button>
            <button
              type="button"
              style={{ ...ss.btnDanger, ...pdeUi.btnCompact }}
              disabled={selectedIds.length === 0}
              onClick={() => removeSelectedBulk(false)}
              title="Remove all selected points"
            >
              Delete ({selectedIds.length})
            </button>
          </div>
        </div>

        <details className="pde-advanced-panel">
          <summary className="pde-advanced-panel__summary">Import &amp; export</summary>
          <div className="pde-advanced-panel__body">
        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", alignItems: "center", rowGap: 10 }}>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              Permit / ref
              <input
                type="text"
                value={exportPermitRef}
                onChange={(e) => setExportPermitRef(e.target.value.slice(0, 120))}
                placeholder="optional — added to exports"
                style={{ ...ss.inp, width: 160, margin: 0, fontSize: 12 }}
              />
            </label>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", letterSpacing: "0.06em", marginRight: 2 }}>EXPORT</span>
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} disabled={!projectId || objects.length === 0} onClick={exportObjectsJson}>
              JSON
            </button>
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} disabled={!projectId || objects.length === 0} onClick={exportGeoJson}>
              GeoJSON
            </button>
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} disabled={!projectId || objects.length === 0} onClick={handleExportCsv} title="CSV with WGS84 from anchor or affine">
              CSV
            </button>
            <button
              type="button"
              style={{ ...ss.btn, ...pdeUi.btnCompact }}
              disabled={!projectId || objects.length === 0}
              onClick={exportKml}
              title="KML uses anchor or 3-point affine below; optional permit ref"
            >
              KML
            </button>
            <button
              type="button"
              style={{ ...ss.btn, ...pdeUi.btnCompact }}
              disabled={!projectId || objects.length === 0}
              onClick={exportGpx}
              title="GPX waypoints (GPS apps, same anchor as KML)"
            >
              GPX
            </button>
            {r2Enabled ? (
              <button
                type="button"
                style={{ ...ss.btn, ...pdeUi.btnCompact }}
                disabled={!projectId || objects.length === 0 || r2Busy}
                onClick={() => uploadLastKmlToR2()}
                title="Upload current KML export to R2 (Documents library list)"
              >
                {r2Busy ? "Uploading…" : "Upload KML to cloud"}
              </button>
            ) : null}
          </div>
          <div style={pdeUi.toolbarDivider} aria-hidden />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <label
              style={{
                ...ss.btn,
                ...pdeUi.btnCompact,
                cursor: projectId ? "pointer" : "not-allowed",
                opacity: projectId ? 1 : 0.5,
                display: "inline-block",
              }}
            >
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                disabled={!projectId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importObjectsJson(f);
                }}
              />
            </label>
            <label
              style={{
                ...ss.btn,
                ...pdeUi.btnCompact,
                cursor: projectId ? "pointer" : "not-allowed",
                opacity: projectId ? 1 : 0.5,
                display: "inline-block",
              }}
            >
              Import KML / KMZ
              <input
                type="file"
                accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/zip,application/xml,text/xml"
                style={{ display: "none" }}
                disabled={!projectId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importKmlOrGpxFile(f, "kml");
                }}
              />
            </label>
            <label
              style={{
                ...ss.btn,
                ...pdeUi.btnCompact,
                cursor: projectId ? "pointer" : "not-allowed",
                opacity: projectId ? 1 : 0.5,
                display: "inline-block",
              }}
            >
              Import GPX
              <input
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                style={{ display: "none" }}
                disabled={!projectId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importKmlOrGpxFile(f, "gpx");
                }}
              />
            </label>
            <label
              style={{
                ...ss.btn,
                ...pdeUi.btnCompact,
                cursor: projectId ? "pointer" : "not-allowed",
                opacity: projectId ? 1 : 0.5,
                display: "inline-block",
              }}
            >
              Import GeoJSON
              <input
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                style={{ display: "none" }}
                disabled={!projectId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importGeoJsonFile(f);
                }}
              />
            </label>
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} onClick={refreshPlans} title="Reload plans from storage (e.g. after upload in Permits)">
              Refresh plans
            </button>
            <button
              type="button"
              style={{ ...ss.btn, ...pdeUi.btnCompact }}
              disabled={!projectId || !planId}
              onClick={clearObjectsOnCurrentPlan}
              title="Remove objects whose plan ID matches this plan"
            >
              Clear this plan
            </button>
            <button
              type="button"
              style={{ ...ss.btn, ...pdeUi.btnCompact }}
              disabled={!projectId}
              onClick={clearMapObjects}
              title="Remove all points placed in Map (GPS) mode"
            >
              Clear map points
            </button>
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact, fontSize: 11 }} onClick={() => setShowShortcuts(true)}>
              Shortcuts (?)
            </button>
          </div>
          </div>
        </details>
        </div>

        {(tool === "boundary" || tool === "area" || tool === "route") && draftRing.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: tool === "route" ? "#eff6ff" : "var(--color-background-secondary,#f0fdfa)",
              border: tool === "route" ? "1px solid #93c5fd" : "1px solid #99f6e4",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: tool === "route" ? "#1d4ed8" : "#0f766e" }}>
              {tool === "boundary" ? "Site boundary draft" : tool === "area" ? "Area draft" : "Escape route draft"} · {draftRing.length} point{draftRing.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              style={{ ...ss.btn, ...pdeUi.btnCompact }}
              disabled={draftRing.length < (tool === "route" ? 2 : 3)}
              onClick={tool === "boundary" ? finishSiteBoundary : tool === "area" ? finishAreaPolygon : finishEscapeRoute}
            >
              {tool === "route"
                ? `Finish route (${draftRing.length >= 2 ? "save" : "need 2+"})`
                : `Close polygon (${draftRing.length >= 3 ? "save" : "need 3+"})`}
            </button>
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} disabled={draftRing.length === 0} onClick={undoDraftPoint}>
              Undo point
            </button>
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} onClick={cancelDraftRing}>
              Cancel
            </button>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Enter to close · Backspace undo · Esc cancel</span>
          </div>
        ) : null}

        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8 }}>
          {workSurface === "map"
            ? tool === "place"
              ? "Map: click to drop a marker. Set anchor below for “add at center”. Export KML/GPX includes all points."
              : tool === "boundary"
                ? "Boundary: click map corners to outline the site. Close polygon saves to project (same as KML import)."
                : tool === "area"
                  ? `Area zone: click corners for ${pdeAreaKindMeta(areaKind).label.toLowerCase()}. Close polygon saves as a reusable area.`
                  : tool === "route"
                    ? "Escape route: click waypoints along the evacuation path. Finish with 2+ points — saved on the project for RAMS."
                    : tool === "pan"
                    ? "Pan: drag the map. Zoom with +/− or mouse wheel."
                    : "Select: click a marker; Ctrl+click for multi-select. Drag a marker to move. Arrows nudge in degrees."
            : tool === "place"
              ? placeOnly
                ? "Place only: tap the plan to drop a marker. Pinch or +/− to zoom; Pan tool to scroll."
                : "Place: tap/click the plan to drop a marker. Pinch or Ctrl+wheel zooms; use Pan to scroll when zoomed."
              : tool === "boundary"
                ? "Boundary: click plan corners for site outline. Uses anchor / affine for GPS when saved."
                : tool === "area"
                  ? `Area zone: click plan corners for ${pdeAreaKindMeta(areaKind).label.toLowerCase()}.`
                  : tool === "route"
                    ? "Escape route: click waypoints on the plan. GPS coordinates use anchor / affine calibration."
                    : tool === "pan"
                    ? "Pan: drag the plan to scroll. Pinch or Ctrl+wheel zooms."
                    : placeOnly
                      ? "Select: tap a marker (drag disabled in Place only). Turn off Place only to move markers."
                      : "Select / move: Ctrl+click markers to multi-select; drag moves the whole group. Arrow keys nudge all selected. Delete removes selected when not typing."}
        </div>

        {workSurface === "plan" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              Zoom {(mapZoom * 100).toFixed(0)}%
              <input
                type="range"
                min={50}
                max={300}
                step={5}
                value={Math.round(mapZoom * 100)}
                onChange={(e) => setMapZoom(clamp(Number(e.target.value) / 100, 0.5, 3))}
                style={{ width: 140 }}
              />
            </label>
            <button type="button" style={{ ...ss.btn, fontSize: 11 }} onClick={fitView}>
              Fit 100% + top
            </button>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {activeTypeStats.length > 0 ? (
            activeTypeStats.map((meta) => (
              <span
                key={meta.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                  background: "var(--color-background-secondary,#f7f7f5)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: meta.shape === "square" ? 2 : "50%",
                    background: meta.color,
                    display: "inline-block",
                  }}
                />
                {meta.label}: {planTypeStats[meta.id]}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>No markers on this surface yet</span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(260px,1.2fr) minmax(280px,1fr)" }}>
        <div className="app-surface-card" style={{ ...ss.card, ...pdeUi.cardAccent }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
              {workSurface === "map" ? "Map workspace" : "Plan preview"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {selectedRow ? (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "var(--color-background-secondary,#f7f7f5)",
                      border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                      maxWidth: "100%",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{drawingObjectLabel(selectedRow)}</span>
                    <span style={{ color: "var(--color-text-secondary)", marginLeft: 8 }}>
                      {isMapPlacement(selectedRow)
                        ? `Lat ${Number(selectedRow.geoLat).toFixed(5)} · Lng ${Number(selectedRow.geoLng).toFixed(5)}`
                        : `X ${Number(selectedRow.x).toFixed(1)}% · Y ${Number(selectedRow.y).toFixed(1)}%`}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 11, padding: "4px 10px" }}
                    onClick={centerPlanOnSelection}
                    disabled={
                      !selectedRow ||
                      (workSurface === "plan" && Boolean(selectedPlan && String(selectedPlan.mimeType || "").toLowerCase().includes("pdf")))
                    }
                    title={
                      workSurface === "map"
                        ? "Fly map to selection (Home)"
                        : "Scroll plan so selection is centered (Home). N/A for PDF-only plan."
                    }
                  >
                    Center view
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Nothing selected</span>
              )}
            </div>
          </div>
          {workSurface === "map" || selectedPlan ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
              {activeTypeStats.map((meta) => (
                <span
                  key={meta.id}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                    background: "var(--color-background-secondary,#f7f7f5)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: meta.shape === "square" ? 1 : "50%",
                      background: meta.color,
                      marginRight: 4,
                      verticalAlign: "middle",
                    }}
                  />
                  {meta.label}: {planTypeStats[meta.id] ?? 0}
                </span>
              ))}
              {activeTypeStats.length === 0 ? (
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>No markers yet — use Quick place or Place tool</span>
              ) : null}
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {workSurface === "map"
                  ? `${mapObjectsForCanvas.length} on map`
                  : `${planObjectsForMap.length} on plan`}
                {escapeRoutesForMap.length > 0 ? ` · ${escapeRoutesForMap.length} escape route(s)` : ""}
              </span>
            </div>
          ) : null}
          {!projectId ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Choose a project first.</div>
          ) : workSurface === "map" ? (
            <div>
              {projectId ? (
                <ProjectDrawingEmergencyIntel
                  project={currentProject}
                  siteLat={siteCoordsForHospital.lat}
                  siteLng={siteCoordsForHospital.lng}
                  hospitalIntel={hospitalIntel}
                  hospitalBusy={hospitalBusy}
                  showHospitalRoute={showHospitalRoute}
                  onToggleShowRoute={setShowHospitalRoute}
                  onFetchHospital={fetchHospitalRoute}
                  onSaveToProject={({ toast: t }) => t && setToast(t)}
                  onCaptureScreenshot={captureHospitalScreenshot}
                  captureBusy={captureBusy}
                  r2Enabled={r2Enabled}
                />
              ) : null}
              <ProjectDrawingMapLayers layers={mapLayers} onChange={handleMapLayerChange} disabled={!projectId} />
              <ProjectDrawingEscapeRoutesPanel
                routes={escapeRoutesForMap}
                highlightId={highlightEscapeRouteId}
                appendMode={escapeRouteAppendMode}
                selectedPointIndex={escapeRoutePointIndex}
                disabled={!projectId}
                onRename={renameEscapeRoute}
                onDelete={deleteEscapeRoute}
                onZoom={zoomEscapeRoute}
                onHighlight={(id) => {
                  setHighlightEscapeRouteId(id);
                  setEscapeRouteAppendMode(false);
                }}
                onToggleAppend={() => {
                  if (!highlightEscapeRouteId) return;
                  setEscapeRouteAppendMode((v) => !v);
                  setTool("select");
                  setWorkSurface("map");
                }}
                onRemovePoint={removeEscapeRoutePointAt}
                onDuplicate={duplicateEscapeRoute}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  style={{ ...ss.btn, ...pdeUi.btnCompact }}
                  disabled={mapObjectsForCanvas.length === 0}
                  onClick={() => mapCanvasRef.current?.fitObjects()}
                  title="Zoom the map to show all map points"
                >
                  Fit map to points
                </button>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Multi-select markers (Ctrl+click), then drag one to move the whole group.
                  {highlightEscapeRouteId ? " Drag orange handles to edit the escape route — click the line to insert a point." : ""}
                </span>
              </div>
              <div id="pde-map-capture-root" className="pde-map-capture-stack">
              <ProjectDrawingMapCanvas
                ref={mapCanvasRef}
                objects={mapObjectsForCanvas}
                areaObjects={mapAreaObjects}
                tool={tool}
                selectedIds={selectedIds}
                basemap={mapBasemap}
                defaultCenter={{ lat: geoAnchor.lat, lng: geoAnchor.lng }}
                boundaryRing={projectBoundaryRing}
                draftRing={draftRing}
                draftRingColor={tool === "boundary" ? "#0d9488" : tool === "route" ? "#0C447C" : pdeAreaKindMeta(areaKind).color}
                draftMode={draftMode}
                escapeRoutes={escapeRoutesForMap}
                highlightEscapeRouteId={highlightEscapeRouteId}
                highlightEscapeRoutePointIndex={escapeRoutePointIndex}
                layers={mapLayers}
                onAddAtLatLng={addMapObject}
                onDraftPoint={addDraftPointMap}
                onBatchGeoUpdate={onBatchGeoUpdate}
                onSelectIds={onMapSelectIds}
                onMarkerDragStart={onMapMarkerDragStart}
                onEscapeRoutePointsUpdate={updateEscapeRoutePoints}
                onEscapeRouteInsertPoint={insertEscapeRoutePoint}
                onEscapeRoutePointSelect={(routeId, pointIndex) => {
                  setHighlightEscapeRouteId(routeId);
                  setEscapeRoutePointIndex(pointIndex);
                  setEscapeRouteAppendMode(false);
                  setTool("select");
                }}
                hospitalOverlay={
                  showHospitalRoute && hospitalIntel?.ring?.length
                    ? { ring: hospitalIntel.ring, hospital: hospitalIntel.hospital, show: true }
                    : null
                }
              />
              {showMapLegend ? (
                <ProjectDrawingMapLegend projectName={currentProject?.name} items={mapLegendItems} />
              ) : null}
              </div>
            </div>
          ) : !selectedPlan ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Select a project and upload a plan above, or switch to Map (GPS) to work without a drawing.
            </div>
          ) : String(selectedPlan.mimeType || "").toLowerCase().includes("pdf") ? (
            <div style={{ fontSize: 12 }}>
              <a href={selectedPlan.dataUrl} target="_blank" rel="noreferrer">
                Open PDF plan
              </a>
              <div style={{ marginTop: 6, color: "var(--color-text-secondary)" }}>
                PDF is view-only here. Use Add at center, then edit X/Y %, or convert plan to PNG and re-upload in Permits plan overlay.
              </div>
            </div>
          ) : (
            <div
              ref={viewportRef}
              onPointerDown={onViewportPointerDown}
              style={{
                position: "relative",
                maxHeight: 480,
                overflow: "auto",
                border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                borderRadius: 10,
                cursor:
                  tool === "place" || tool === "boundary" || tool === "area" || tool === "route"
                    ? "crosshair"
                    : tool === "pan"
                      ? "grab"
                      : "default",
                touchAction: tool === "pan" ? "none" : "manipulation",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              <div
                className="pde-zoom-overlay"
                role="presentation"
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  className="pde-zoom-overlay-btn"
                  aria-label="Zoom plan in"
                  title="Zoom in"
                  style={pdeUi.zoomOverlayBtn}
                  onClick={() => bumpPlanZoom(0.12)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="pde-zoom-overlay-btn"
                  aria-label="Zoom plan out"
                  title="Zoom out"
                  style={pdeUi.zoomOverlayBtn}
                  onClick={() => bumpPlanZoom(-0.12)}
                >
                  −
                </button>
              </div>
              <div
                ref={mapContentRef}
                role="presentation"
                onPointerDown={onPlanBackgroundPointerDown}
                style={{
                  position: "relative",
                  width: `${mapZoom * 100}%`,
                  minWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <img
                  src={selectedPlan.dataUrl}
                  alt={selectedPlan.name}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    background: "var(--color-background-secondary,#f7f7f5)",
                    pointerEvents: "none",
                    userSelect: "none",
                    verticalAlign: "top",
                  }}
                />
                {snapGrid ? (
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.35 }}
                  >
                    {Array.from({ length: 21 }, (_, i) => (
                      <line key={`v${i}`} x1={i * 5} y1={0} x2={i * 5} y2={100} stroke="#94a3b8" strokeWidth="0.15" />
                    ))}
                    {Array.from({ length: 21 }, (_, i) => (
                      <line key={`h${i}`} x1={0} y1={i * 5} x2={100} y2={i * 5} stroke="#94a3b8" strokeWidth="0.15" />
                    ))}
                  </svg>
                ) : null}
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
                >
                  {planAreaObjects.map((row) => {
                    const kind = pdeAreaKindMeta(row.meta?.areaKind);
                    const pts = (row.ring || [])
                      .map((p) => `${Number(p.x)},${Number(p.y)}`)
                      .join(" ");
                    if (!pts) return null;
                    return (
                      <polygon
                        key={row.id}
                        points={pts}
                        fill={kind.fill}
                        stroke={kind.color}
                        strokeWidth={selectedIds.includes(row.id) ? 0.6 : 0.35}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  {draftRing.length >= 2 ? (
                    <polyline
                      points={draftRing.map((p) => `${Number(p.x)},${Number(p.y)}`).join(" ")}
                      fill="none"
                      stroke={tool === "boundary" ? "#0d9488" : pdeAreaKindMeta(areaKind).color}
                      strokeWidth={0.45}
                      strokeDasharray="1.2 0.8"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  {draftRing.length >= 3 ? (
                    <polygon
                      points={draftRing.map((p) => `${Number(p.x)},${Number(p.y)}`).join(" ")}
                      fill={tool === "boundary" ? "rgba(13,148,136,0.12)" : pdeAreaKindMeta(areaKind).fill}
                      stroke={tool === "boundary" ? "#0d9488" : pdeAreaKindMeta(areaKind).color}
                      strokeWidth={0.4}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  {draftRing.map((p, idx) => (
                    <circle
                      key={`draft-${idx}`}
                      cx={Number(p.x)}
                      cy={Number(p.y)}
                      r={0.9}
                      fill={tool === "boundary" ? "#0d9488" : pdeAreaKindMeta(areaKind).color}
                      stroke="#fff"
                      strokeWidth={0.25}
                    />
                  ))}
                </svg>
                {planObjectsForMap.map((row) => {
                  const labelFull = String(row.label || "").trim() || drawingObjectTypeMeta(row.type).label;
                  const label = shortMapLabel(labelFull);
                  return (
                    <div key={row.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        title={drawingObjectLabel(row)}
                        onPointerDown={(e) => onMarkerPointerDown(e, row)}
                        style={{
                          ...markerStyle(row.type, selectedIds.includes(row.id), {
                            placeOnly,
                            largeHit: placeOnly || tool !== "select",
                          }),
                          left: `${row.x}%`,
                          top: `${row.y}%`,
                        }}
                      />
                      {showMapLabels ? (
                        <div
                          style={{
                            position: "absolute",
                            left: `${row.x}%`,
                            top: `${row.y}%`,
                            transform: "translate(-50%, 14px)",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#0f172a",
                            textShadow: "0 0 4px #fff, 0 0 6px #fff",
                            pointerEvents: "none",
                            zIndex: 4,
                            maxWidth: 120,
                            textAlign: "center",
                            lineHeight: 1.2,
                          }}
                          title={labelFull}
                        >
                          {label}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="app-surface-card" style={{ ...ss.card, ...pdeUi.cardAccent }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>Objects ({filteredList.length}/{objects.length})</div>
            <span style={ss.chip}>{projectId ? "Project scoped" : "Select project"}</span>
          </div>
          <input
            style={{ ...ss.inp, marginBottom: 8 }}
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            placeholder="Search labels or types…"
          />
          {!projectId ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Choose project first.</div>
          ) : objects.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              No objects yet. Use Place for points (fire exit, extinguisher, muster, parking…) or Area zone / Boundary for polygons.
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>No objects match filter or visibility.</div>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 540, overflow: "auto" }}>
              {filteredList.map((row) => (
                <div
                  key={row.id}
                  ref={(el) => {
                    listItemRefs.current[row.id] = el;
                  }}
                  style={{
                    border: `1px solid ${selectedIds.includes(row.id) ? "#0d9488" : "var(--color-border-tertiary,#e5e5e5)"}`,
                    borderRadius: 8,
                    padding: 8,
                    background: selectedIds.includes(row.id) ? "rgba(13,148,136,0.06)" : undefined,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 110px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) => {
                          const s = new Set(prev);
                          if (e.target.checked) s.add(row.id);
                          else s.delete(row.id);
                          return [...s];
                        });
                      }}
                      title="Select for bulk actions"
                      aria-label={`Select ${drawingObjectLabel(row)}`}
                    />
                    <input
                      style={{ ...ss.inp, margin: 0 }}
                      value={row.label || ""}
                      onChange={(e) => upsertObject(row.id, { label: e.target.value.slice(0, 120) })}
                      onFocus={() => {
                        beginFieldSession();
                        setSelectedIds([row.id]);
                      }}
                      onBlur={endFieldSession}
                      placeholder={drawingObjectLabel(row)}
                    />
                    <select
                      style={{ ...ss.inp, margin: 0 }}
                      value={row.type}
                      onChange={(e) => upsertObject(row.id, { type: e.target.value })}
                      onFocus={() => {
                        beginFieldSession();
                        setSelectedIds([row.id]);
                      }}
                      onBlur={endFieldSession}
                    >
                      {PROJECT_DRAWING_OBJECT_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr auto auto", gap: 8, alignItems: "center" }}>
                    <span aria-hidden style={{ width: 1 }} />
                    {isMapPlacement(row) ? (
                      <>
                        <input
                          style={{ ...ss.inp, margin: 0 }}
                          inputMode="decimal"
                          value={String(row.geoLat ?? "")}
                          onChange={(e) =>
                            upsertObject(row.id, { geoLat: clamp(Number(e.target.value) || 0, -85, 85) })
                          }
                          onFocus={() => {
                            beginFieldSession();
                            setSelectedIds([row.id]);
                          }}
                          onBlur={endFieldSession}
                          placeholder="Latitude"
                        />
                        <input
                          style={{ ...ss.inp, margin: 0 }}
                          inputMode="decimal"
                          value={String(row.geoLng ?? "")}
                          onChange={(e) =>
                            upsertObject(row.id, { geoLng: clamp(Number(e.target.value) || 0, -180, 180) })
                          }
                          onFocus={() => {
                            beginFieldSession();
                            setSelectedIds([row.id]);
                          }}
                          onBlur={endFieldSession}
                          placeholder="Longitude"
                        />
                      </>
                    ) : (
                      <>
                        <input
                          style={{ ...ss.inp, margin: 0 }}
                          inputMode="decimal"
                          value={String(row.x)}
                          onChange={(e) => upsertObject(row.id, { x: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          onFocus={() => {
                            beginFieldSession();
                            setSelectedIds([row.id]);
                          }}
                          onBlur={endFieldSession}
                          placeholder="X %"
                        />
                        <input
                          style={{ ...ss.inp, margin: 0 }}
                          inputMode="decimal"
                          value={String(row.y)}
                          onChange={(e) => upsertObject(row.id, { y: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          onFocus={() => {
                            beginFieldSession();
                            setSelectedIds([row.id]);
                          }}
                          onBlur={endFieldSession}
                          placeholder="Y %"
                        />
                      </>
                    )}
                    <button type="button" style={ss.btn} onClick={() => duplicateObject(row)}>
                      Copy
                    </button>
                    <button type="button" style={ss.btn} onClick={() => removeObject(row.id)}>
                      Remove
                    </button>
                  </div>
                  {row.type === "atex_zone" ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: "var(--color-background-secondary,#f8fafc)",
                        border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                        gap: 8,
                      }}
                    >
                      <div>
                        <label style={ss.lbl} htmlFor="project-drawing-meta">Area classification</label>
                        <select
                          style={ss.inp}
                          value={row.meta?.areaClassification || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { areaClassification: e.target.value } })}
                         id="project-drawing-meta">
                          <option value="">—</option>
                          {["zone_0", "zone_1", "zone_2", "zone_20", "zone_21", "zone_22", "safe"].map((z) => (
                            <option key={z} value={z}>
                              {z.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={ss.lbl} htmlFor="project-drawing-meta-2">Atmosphere</label>
                        <select
                          style={ss.inp}
                          value={row.meta?.atmosphereType || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { atmosphereType: e.target.value } })}
                         id="project-drawing-meta-2">
                          <option value="">—</option>
                          {["gas", "dust", "mist", "hybrid"].map((z) => (
                            <option key={z} value={z}>
                              {z}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={ss.lbl} htmlFor="project-drawing-meta-3">Substance / vapour (if applicable)</label>
                        <input
                          style={ss.inp}
                          value={row.meta?.substance || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { substance: e.target.value } })}
                         id="project-drawing-meta-3" />
                      </div>
                      <div>
                        <label style={ss.lbl} htmlFor="project-drawing-meta-4">T class</label>
                        <input
                          style={ss.inp}
                          value={row.meta?.temperatureClass || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { temperatureClass: e.target.value } })}
                          placeholder="e.g. T3"
                         id="project-drawing-meta-4" />
                      </div>
                      <div>
                        <label style={ss.lbl} htmlFor="project-drawing-meta-5">Equipment group</label>
                        <input
                          style={ss.inp}
                          value={row.meta?.equipmentGroup || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { equipmentGroup: e.target.value } })}
                          placeholder="e.g. II A"
                         id="project-drawing-meta-5" />
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, gridColumn: "1 / -1" }}>
                        <input
                          type="checkbox"
                          checked={!!row.meta?.permitRequired}
                          onChange={(e) => upsertObject(row.id, { meta: { permitRequired: e.target.checked } })}
                        />
                        Permit required for work in this zone
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="app-surface-card" style={{ ...ss.card, marginTop: 12, ...pdeUi.cardAccent }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>Interactive map (OpenStreetMap)</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, maxWidth: 720 }}>
              Plan overlay points use the anchor box below, or optional <strong>3-point affine</strong> per plan for non-rectangular georeferencing. Map (GPS) points use stored lat/lng. Preview matches KML/GPX/CSV/GeoJSON — not survey-grade. Anchor is saved per project; affine + control points are saved per plan.
            </div>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={showGeoPreview} onChange={(e) => setShowGeoPreview(e.target.checked)} />
            Show map
          </label>
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", marginBottom: showGeoPreview ? 12 : 0 }}>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-lat">Center lat</label>
            <input
              type="number"
              step="0.0001"
              value={geoAnchor.lat}
              onChange={(e) => setGeoAnchor((a) => ({ ...a, lat: Number(e.target.value) || a.lat }))}
              style={ss.inp}
             id="project-drawing-lat" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-lng">Center lng</label>
            <input
              type="number"
              step="0.0001"
              value={geoAnchor.lng}
              onChange={(e) => setGeoAnchor((a) => ({ ...a, lng: Number(e.target.value) || a.lng }))}
              style={ss.inp}
             id="project-drawing-lng" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-span-lat">Span lat (°)</label>
            <input
              type="number"
              step="0.0001"
              min={0.0005}
              value={geoAnchor.spanLat}
              onChange={(e) =>
                setGeoAnchor((a) => ({ ...a, spanLat: clamp(Number(e.target.value) || a.spanLat, 0.0005, 5) }))
              }
              style={ss.inp}
             id="project-drawing-span-lat" />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="project-drawing-span-lng">Span lng (°)</label>
            <input
              type="number"
              step="0.0001"
              min={0.0005}
              value={geoAnchor.spanLng}
              onChange={(e) =>
                setGeoAnchor((a) => ({ ...a, spanLng: clamp(Number(e.target.value) || a.spanLng, 0.0005, 5) }))
              }
              style={ss.inp}
             id="project-drawing-span-lng" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={{ ...ss.btn, flex: "1 1 140px" }}
              disabled={!projectId || siteGeoStatus.busy}
              onClick={() => reapplyProjectSiteAnchor()}
              title="Re-centre anchor from project postcode or coordinates"
            >
              Use project site
            </button>
            <button
              type="button"
              style={{ ...ss.btn, flex: "1 1 120px" }}
              onClick={() => setGeoAnchor({ ...DEFAULT_GEO_ANCHOR })}
            >
              Reset anchor
            </button>
          </div>
        </div>

        {planId ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>This plan — WGS84 from plan %</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 10, alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="pde-plan-geo"
                  checked={planGeoMode === "anchor"}
                  onChange={() => {
                    setPlanGeoMode("anchor");
                    persistPlanGeoEntry({ mode: "anchor" });
                  }}
                />
                Rectangle anchor
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="pde-plan-geo"
                  checked={planGeoMode === "affine"}
                  onChange={() => setPlanGeoMode("affine")}
                />
                3-point affine
              </label>
              {planGeoMode === "affine" && planAffine ? (
                <span style={{ fontSize: 12, color: "#0f766e", fontWeight: 600 }}>Calibrated</span>
              ) : null}
            </div>
            {planGeoMode === "affine" ? (
              <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  Enter three known points: position on the plan (0–100% from top-left) and real lat/lng. Then Apply.
                </div>
                {[0, 1, 2].map((idx) => (
                  <div key={idx} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 56, fontWeight: 600 }}>Pt {idx + 1}</span>
                    <input
                      style={{ ...ss.inp, width: 72, margin: 0 }}
                      inputMode="decimal"
                      placeholder="x %"
                      value={controlPoints[idx]?.px ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setControlPoints((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], px: v };
                          return next;
                        });
                      }}
                    />
                    <input
                      style={{ ...ss.inp, width: 72, margin: 0 }}
                      inputMode="decimal"
                      placeholder="y %"
                      value={controlPoints[idx]?.py ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setControlPoints((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], py: v };
                          return next;
                        });
                      }}
                    />
                    <input
                      style={{ ...ss.inp, width: 96, margin: 0 }}
                      inputMode="decimal"
                      placeholder="lat"
                      value={controlPoints[idx]?.lat ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setControlPoints((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], lat: v };
                          return next;
                        });
                      }}
                    />
                    <input
                      style={{ ...ss.inp, width: 96, margin: 0 }}
                      inputMode="decimal"
                      placeholder="lng"
                      value={controlPoints[idx]?.lng ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setControlPoints((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], lng: v };
                          return next;
                        });
                      }}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <button type="button" style={{ ...ss.btnP, ...pdeUi.btnCompact }} onClick={applyAffineCalibration}>
                    Apply 3-point calibration
                  </button>
                  <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} onClick={resetPlanGeoCalibration}>
                    Reset plan geo
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showGeoPreview && projectId ? (
          <ProjectDrawingGeoMap
            points={geoPreviewPoints}
            selectedIds={selectedIds}
            onSelect={onGeoMapSelect}
            defaultCenter={{ lat: geoAnchor.lat, lng: geoAnchor.lng }}
          />
        ) : null}
      </div>

      {showShortcuts ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: "var(--z-dialog, 60)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="app-surface-card"
            style={{ ...ss.card, maxWidth: 420, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Keyboard shortcuts</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: "var(--color-text-primary)" }}>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>1</kbd>–
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>5</kbd> — Place / Select / Pan / Boundary / Area zone
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Enter</kbd> — Close polygon (Boundary or Area, 3+ points)
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Backspace</kbd> — Undo last polygon point while drawing
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Ctrl</kbd>+click marker — Add/remove from selection; drag moves whole selection
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Arrows</kbd> — Nudge selected point(s) (Shift = larger step)
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Ctrl</kbd>+
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Z</kbd> /{" "}
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Shift</kbd>+
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Z</kbd> — Undo / Redo
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Ctrl</kbd>+
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Y</kbd> — Redo
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Ctrl</kbd>+
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>C</kbd> — Copy coords (all selected)
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Delete</kbd> /{" "}
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Backspace</kbd> — Remove selected object(s)
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>?</kbd> — This help
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Home</kbd> — Center plan view on primary selection (raster plans)
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Esc</kbd> — Clear selection / close
              </li>
              <li>
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>Ctrl</kbd>+wheel — Zoom plan
              </li>
            </ul>
            <button type="button" style={{ ...ss.btn, marginTop: 12 }} onClick={() => setShowShortcuts(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div role="status" aria-live="polite" style={pdeUi.toast}>
          {toast}
        </div>
      ) : null}

      {copyFallbackText ? (
        <div
          className="app-module-dialog-overlay"
          role="presentation"
          style={{ zIndex: "var(--z-palette, 70)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCopyFallbackText("");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pde-copy-fallback-title"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "88vh",
              overflowY: "auto",
              background: "var(--color-background-primary,#fff)",
              borderRadius: 10,
              border: "1px solid var(--color-border-tertiary,#e5e5e5)",
              boxShadow: "var(--shadow-sm)",
              padding: 16,
            }}
          >
            <div id="pde-copy-fallback-title" style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
              Copy coordinates
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px", lineHeight: 1.45 }}>
              Clipboard access was blocked. Select all (Ctrl+A) and copy (Ctrl+C), or use the button below.
            </p>
            <textarea
              readOnly
              value={copyFallbackText}
              style={{
                width: "100%",
                minHeight: 160,
                boxSizing: "border-box",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                resize: "vertical",
              }}
              onFocus={(e) => e.target.select()}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={ss.btn} onClick={() => setCopyFallbackText("")}>
                Close
              </button>
              <button
                type="button"
                style={ss.btnO}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(copyFallbackText);
                    setCopyFallbackText("");
                    setToast("Copied coordinates to clipboard");
                  } catch {
                    setToast("Use Ctrl+C on the selected text");
                  }
                }}
              >
                Copy again
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
