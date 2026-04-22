import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { getOrgId, loadOrgScoped as load, loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import { consumeWorkspaceNavTarget, openWorkspaceView } from "../utils/workspaceNavContext";
import { listProjectPlans } from "./permits/permitPlanOverlayRegistry";
import {
  PROJECT_DRAWING_OBJECT_TYPES,
  buildProjectDrawingObject,
  drawingObjectLabel,
  drawingObjectTypeMeta,
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
import { loadDrawingEditorPrefs, saveDrawingEditorPrefs } from "./permits/projectDrawingEditorPrefs";
import {
  validateDrawingImportJson,
  parseKmlPoints,
  parseGpxPoints,
  parseGeoJsonPoints,
} from "./permits/projectDrawingImport";
import { solvePlanAffineFromControlPoints } from "./permits/projectDrawingAffine";
import { isR2StorageConfigured, uploadFileToR2Storage } from "../lib/r2Storage";
import { pushAudit } from "../utils/auditLog";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { syncOrgSlugIfNeeded } from "../utils/orgMembership";
import ProjectDrawingGeoMap from "./ProjectDrawingGeoMap";
import ProjectDrawingMapCanvas from "./ProjectDrawingMapCanvas";

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
    padding: "8px 16px",
    borderRadius: 9,
    border: active ? "1px solid #0d9488" : "1px solid transparent",
    background: active ? "var(--color-background-primary,#fff)" : "transparent",
    color: "var(--color-text-primary)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "DM Sans,sans-serif",
    minHeight: 40,
    lineHeight: 1.2,
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
    width: 38,
    height: 38,
    borderRadius: 10,
    border: "1px solid var(--color-border-tertiary,#e5e5e5)",
    background: "rgba(255,255,255,0.96)",
    cursor: "pointer",
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
    minHeight: 38,
    padding: "8px 12px",
  },
  toast: {
    position: "fixed",
    bottom: 28,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 2000,
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
};

const ss = {
  ...ms,
  btnO: {
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
  },
};

const HISTORY_CAP = 50;
const PDE_SESSION_KEY = "mysafeops_pde_session_v1";
const R2_UPLOADS_KEY = "mysafeops_r2_uploads";

const emptyControlPoint = () => ({ px: "", py: "", lat: "", lng: "" });

function escapeCsvCell(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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

function markerStyle(type, selected) {
  const meta = drawingObjectTypeMeta(type);
  const base = {
    position: "absolute",
    width: 16,
    height: 16,
    transform: "translate(-50%,-50%)",
    border: selected ? "3px solid #fff" : "2px solid #fff",
    boxShadow: selected
      ? `0 0 0 2px ${meta.color}, 0 0 0 4px rgba(12,68,124,0.35)`
      : `0 0 0 1px ${meta.color}`,
    background: meta.color,
    pointerEvents: "auto",
    cursor: "grab",
    zIndex: selected ? 3 : 2,
    touchAction: "none",
  };
  if (meta.shape === "circle") return { ...base, borderRadius: "50%" };
  if (meta.shape === "square") return { ...base, borderRadius: 3 };
  if (meta.shape === "diamond") return { ...base, borderRadius: 2, transform: "translate(-50%,-50%) rotate(45deg)" };
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
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [projectPlans, setProjectPlans] = useState(() => listProjectPlans());
  const [rows, setRows] = useState(() => listProjectDrawingObjects());
  const [projectId, setProjectId] = useState("");
  const [planId, setPlanId] = useState("");
  const [objectType, setObjectType] = useState("zone");
  const [visibleType, setVisibleType] = useState("all");
  const [tool, setTool] = useState(() => {
    const t = loadPdeSession().tool;
    return t === "select" || t === "pan" || t === "place" ? t : "place";
  });
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
  const [planGeoMode, setPlanGeoMode] = useState("anchor");
  const [planAffine, setPlanAffine] = useState(null);
  const [controlPoints, setControlPoints] = useState(() => [emptyControlPoint(), emptyControlPoint(), emptyControlPoint()]);
  const [exportPermitRef, setExportPermitRef] = useState(() => String(loadPdeSession().exportPermitRef || ""));
  const [r2Busy, setR2Busy] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState(null);
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
      window.prompt("Copy:", blob);
      setToast("Copy the text from the dialog");
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
    if (!projectId) return;
    const orgSaved = loadDrawingEditorPrefs().geoAnchorByProject?.[projectId];
    const sessSaved = loadPdeSession().geoAnchorByProject?.[projectId];
    const saved = orgSaved || sessSaved;
    if (saved && typeof saved.lat === "number" && typeof saved.lng === "number") {
      setGeoAnchor({
        lat: saved.lat,
        lng: saved.lng,
        spanLat: typeof saved.spanLat === "number" ? clamp(saved.spanLat, 0.0005, 5) : DEFAULT_GEO_ANCHOR.spanLat,
        spanLng: typeof saved.spanLng === "number" ? clamp(saved.spanLng, 0.0005, 5) : DEFAULT_GEO_ANCHOR.spanLng,
      });
    } else {
      setGeoAnchor({ ...DEFAULT_GEO_ANCHOR });
    }
  }, [projectId]);

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
      snapGrid,
      showMapLabels,
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
  }, [mapZoom, tool, snapGrid, showMapLabels, showGeoPreview, workSurface, mapBasemap, geoAnchor, projectId, planId, exportPermitRef]);

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

  const importKmlOrGpxFile = (file, kind) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const pts = kind === "kml" ? parseKmlPoints(text) : parseGpxPoints(text);
      if (pts.length === 0) {
        setToast(`No waypoints found in ${kind.toUpperCase()}`);
        return;
      }
      if (!projectId) {
        window.alert("Select a project first.");
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
      setToast(`Imported ${merged.length} point(s) from ${kind.toUpperCase()}`);
    };
    reader.readAsText(file);
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

  const exportCsv = () => {
    if (!projectId || objects.length === 0) return;
    const permitRef = String(exportPermitRef || "").trim();
    const header = "id,objectType,label,placement,xPercent,yPercent,lat,lng,projectId,planId,permitRef";
    const lines = [header];
    for (const row of objects) {
      const { lat, lng } = getObjectLatLng(row, geoAnchor, effectiveAffine);
      lines.push(
        [
          escapeCsvCell(row.id),
          escapeCsvCell(row.type),
          escapeCsvCell(row.label || drawingObjectLabel(row)),
          escapeCsvCell(row.placement || "plan"),
          escapeCsvCell(row.x),
          escapeCsvCell(row.y),
          escapeCsvCell(lat),
          escapeCsvCell(lng),
          escapeCsvCell(row.projectId),
          escapeCsvCell(row.planId),
          escapeCsvCell(permitRef),
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `project-drawing-${projectId || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("CSV export started");
  };

  const r2Enabled = isR2StorageConfigured();

  const uploadBlobToOrgR2 = useCallback(
    async (blob, filename) => {
      if (!blob || !r2Enabled) return;
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
          uploadedAt: new Date().toISOString(),
          source: "project-drawing-editor",
        };
        const next = [row, ...loadR2UploadsList()];
        saveR2UploadsList(next);
        pushAudit({ action: "r2_upload", entity: "document", detail: result.key });
        setToast(`Uploaded ${filename} to cloud library`);
      } catch (e) {
        setToast(e?.message || "Upload failed");
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
    const el = document.getElementById("pde-map-capture-root");
    if (!el) {
      setToast("Map not ready");
      return;
    }
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        logging: false,
        backgroundColor: "#f1f5f9",
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        setToast("PNG blob failed");
        return;
      }
      await uploadBlobToOrgR2(blob, `project-map-${projectId || "export"}.png`);
    } catch {
      setToast("PNG capture failed (tile CORS) — try KML export");
    }
  };

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
        row.placement !== "map" && (!row.planId || row.planId === selectedPlan.id)
    );
  }, [visibleObjects, selectedPlan]);

  const mapObjectsForCanvas = useMemo(
    () =>
      visibleObjects.filter(
        (row) => row.placement === "map" && Number.isFinite(row.geoLat) && Number.isFinite(row.geoLng)
      ),
    [visibleObjects]
  );

  const planTypeStats = useMemo(() => {
    const counts = Object.fromEntries(PROJECT_DRAWING_OBJECT_TYPES.map((t) => [t.id, 0]));
    const statRows = workSurface === "map" ? mapObjectsForCanvas : planObjectsForMap;
    for (const row of statRows) {
      if (counts[row.type] != null) counts[row.type] += 1;
    }
    return counts;
  }, [workSurface, mapObjectsForCanvas, planObjectsForMap]);

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
      if (!projectId) return;
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
    [projectId, objectType, pushHistory]
  );

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
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        logging: false,
        backgroundColor: "#f1f5f9",
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `project-map-${projectId || "export"}.png`;
      a.click();
      setToast("PNG saved — attach to RAMS / permits or documents");
    } catch {
      setToast("PNG failed (tile CORS) — use Win+Shift+S or export KML");
    }
  }, [projectId]);

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
    if (tool !== "place") return;
    if (!selectedPlan || String(selectedPlan.mimeType || "").toLowerCase().includes("pdf")) return;
    const { x, y } = clientToPercent(e.clientX, e.clientY);
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
  }, [removeObject, removeSelectedBulk, pushHistory, gridStep, upsertObject]);

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
        if (!typing && selectedIdsRef.current.length > 0) {
          setSelectedIds([]);
          e.preventDefault();
        }
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
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        if (e.key === "1") setTool("place");
        if (e.key === "2") setTool("select");
        if (e.key === "3") setTool("pan");
      }
      if (e.key === "Home" && !typing && selectedIdsRef.current.length > 0) {
        e.preventDefault();
        centerPlanOnSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelectedCoords, showShortcuts, undo, redo, centerPlanOnSelection]);

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
              Use tool <strong>Place</strong> and click the plan or map to add zones, fire exits, master points, etc.
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

      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 12, ...pdeUi.cardAccent }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <div>
            <label style={ss.lbl}>Project</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSelectedIds([]);
              }}
              style={ss.inp}
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Plan overlay</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={ss.inp}>
              <option value="">No plan selected</option>
              {plansForCurrentProject.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Object type (new)</label>
            <select value={objectType} onChange={(e) => setObjectType(e.target.value)} style={ss.inp}>
              {PROJECT_DRAWING_OBJECT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Visible on map</label>
            <select value={visibleType} onChange={(e) => setVisibleType(e.target.value)} style={ss.inp}>
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

        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>SURFACE</span>
          <div style={pdeUi.toolWrap} role="tablist" aria-label="Work surface">
            <button
              type="button"
              role="tab"
              aria-selected={workSurface === "plan"}
              disabled={!canUsePlanSurface}
              style={{ ...pdeUi.toolBtn(workSurface === "plan"), opacity: canUsePlanSurface ? 1 : 0.5 }}
              onClick={() => canUsePlanSurface && setWorkSurface("plan")}
              title={!canUsePlanSurface ? "Upload a plan in Permits first" : "Work on PDF or image overlay"}
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
              <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} onClick={captureMapPng} disabled={!projectId}>
                Save map PNG
              </button>
              {r2Enabled ? (
                <button
                  type="button"
                  style={{ ...ss.btn, ...pdeUi.btnCompact }}
                  onClick={() => uploadMapPngToR2()}
                  disabled={!projectId || r2Busy}
                  title="Save capture to Cloudflare R2 (same list as Documents)"
                >
                  {r2Busy ? "Uploading…" : "Upload PNG to cloud"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>TOOL</span>
            <div style={pdeUi.toolWrap} role="tablist" aria-label="Drawing tool">
              <button
                type="button"
                role="tab"
                aria-selected={tool === "place"}
                style={pdeUi.toolBtn(tool === "place")}
                onClick={() => setTool("place")}
              >
                Place
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tool === "select"}
                style={pdeUi.toolBtn(tool === "select")}
                onClick={() => setTool("select")}
              >
                Select
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tool === "pan"}
                style={pdeUi.toolBtn(tool === "pan")}
                onClick={() => setTool("pan")}
              >
                Pan
              </button>
            </div>
          </div>
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
            <kbd style={{ fontFamily: "inherit", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>3</kbd> · Ctrl+wheel zoom
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center", rowGap: 10 }}>
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
          <div style={pdeUi.toolbarDivider} aria-hidden />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
            <button type="button" style={{ ...ss.btn, ...pdeUi.btnCompact }} disabled={!projectId || objects.length === 0} onClick={exportCsv} title="CSV with WGS84 from anchor or affine">
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
              Import KML
              <input
                type="file"
                accept=".kml,application/vnd.google-earth.kml+xml,application/xml,text/xml"
                style={{ display: "none" }}
                disabled={!projectId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importKmlOrGpxFile(f, "kml");
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

        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8 }}>
          {workSurface === "map"
            ? tool === "place"
              ? "Map: click to drop a marker at GPS position. Set anchor below for “add at center”. Export KML/GPX includes all points."
              : tool === "pan"
                ? "Pan: drag the map. Zoom with +/− or mouse wheel."
                : "Select: click a marker; Ctrl+click for multi-select. Drag a marker to move. Arrows nudge in degrees."
            : tool === "place"
              ? "Place: click the image to drop a marker. Ctrl+wheel zooms; scrollbars pan when zoomed."
              : tool === "pan"
                ? "Pan: drag the plan to scroll. Ctrl+wheel zooms."
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
          {PROJECT_DRAWING_OBJECT_TYPES.map((meta) => (
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
              {meta.label}
            </span>
          ))}
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
              {PROJECT_DRAWING_OBJECT_TYPES.map((meta) => (
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
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {workSurface === "map"
                  ? `${mapObjectsForCanvas.length} on map (visibility filter)`
                  : `${planObjectsForMap.length} on plan (visibility filter)`}
              </span>
            </div>
          ) : null}
          {!projectId ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Choose a project first.</div>
          ) : workSurface === "map" ? (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
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
                </span>
              </div>
              <ProjectDrawingMapCanvas
                ref={mapCanvasRef}
                objects={mapObjectsForCanvas}
                tool={tool}
                selectedIds={selectedIds}
                basemap={mapBasemap}
                defaultCenter={{ lat: geoAnchor.lat, lng: geoAnchor.lng }}
                onAddAtLatLng={addMapObject}
                onBatchGeoUpdate={onBatchGeoUpdate}
                onSelectIds={onMapSelectIds}
                onMarkerDragStart={onMapMarkerDragStart}
              />
            </div>
          ) : !selectedPlan ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Select a project and upload a plan in Permits, or switch to Map (GPS) to work without a drawing.
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
                cursor: tool === "place" ? "crosshair" : tool === "pan" ? "grab" : "default",
                touchAction: tool === "pan" ? "none" : "auto",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              <div
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
                  aria-label="Zoom plan in"
                  title="Zoom in"
                  style={pdeUi.zoomOverlayBtn}
                  onClick={() => bumpPlanZoom(0.12)}
                >
                  +
                </button>
                <button
                  type="button"
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
                          ...markerStyle(row.type, selectedIds.includes(row.id)),
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
              No objects yet. Add zone, excavation, fire exit, master point, or ATEX / DSEAR zone marker.
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
                        <label style={ss.lbl}>Area classification</label>
                        <select
                          style={ss.inp}
                          value={row.meta?.areaClassification || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { areaClassification: e.target.value } })}
                        >
                          <option value="">—</option>
                          {["zone_0", "zone_1", "zone_2", "zone_20", "zone_21", "zone_22", "safe"].map((z) => (
                            <option key={z} value={z}>
                              {z.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={ss.lbl}>Atmosphere</label>
                        <select
                          style={ss.inp}
                          value={row.meta?.atmosphereType || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { atmosphereType: e.target.value } })}
                        >
                          <option value="">—</option>
                          {["gas", "dust", "mist", "hybrid"].map((z) => (
                            <option key={z} value={z}>
                              {z}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={ss.lbl}>Substance / vapour (if applicable)</label>
                        <input
                          style={ss.inp}
                          value={row.meta?.substance || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { substance: e.target.value } })}
                        />
                      </div>
                      <div>
                        <label style={ss.lbl}>T class</label>
                        <input
                          style={ss.inp}
                          value={row.meta?.temperatureClass || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { temperatureClass: e.target.value } })}
                          placeholder="e.g. T3"
                        />
                      </div>
                      <div>
                        <label style={ss.lbl}>Equipment group</label>
                        <input
                          style={ss.inp}
                          value={row.meta?.equipmentGroup || ""}
                          onChange={(e) => upsertObject(row.id, { meta: { equipmentGroup: e.target.value } })}
                          placeholder="e.g. II A"
                        />
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
            <label style={ss.lbl}>Center lat</label>
            <input
              type="number"
              step="0.0001"
              value={geoAnchor.lat}
              onChange={(e) => setGeoAnchor((a) => ({ ...a, lat: Number(e.target.value) || a.lat }))}
              style={ss.inp}
            />
          </div>
          <div>
            <label style={ss.lbl}>Center lng</label>
            <input
              type="number"
              step="0.0001"
              value={geoAnchor.lng}
              onChange={(e) => setGeoAnchor((a) => ({ ...a, lng: Number(e.target.value) || a.lng }))}
              style={ss.inp}
            />
          </div>
          <div>
            <label style={ss.lbl}>Span lat (°)</label>
            <input
              type="number"
              step="0.0001"
              min={0.0005}
              value={geoAnchor.spanLat}
              onChange={(e) =>
                setGeoAnchor((a) => ({ ...a, spanLat: clamp(Number(e.target.value) || a.spanLat, 0.0005, 5) }))
              }
              style={ss.inp}
            />
          </div>
          <div>
            <label style={ss.lbl}>Span lng (°)</label>
            <input
              type="number"
              step="0.0001"
              min={0.0005}
              value={geoAnchor.spanLng}
              onChange={(e) =>
                setGeoAnchor((a) => ({ ...a, spanLng: clamp(Number(e.target.value) || a.spanLng, 0.0005, 5) }))
              }
              style={ss.inp}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="button" style={{ ...ss.btn, width: "100%" }} onClick={() => setGeoAnchor({ ...DEFAULT_GEO_ANCHOR })}>
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
          <ProjectDrawingGeoMap points={geoPreviewPoints} selectedIds={selectedIds} onSelect={onGeoMapSelect} />
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
            zIndex: 1000,
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
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>1</kbd> /{" "}
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>2</kbd> /{" "}
                <kbd style={{ fontFamily: "inherit", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>3</kbd> — Place / Select / Pan
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
    </div>
  );
}
