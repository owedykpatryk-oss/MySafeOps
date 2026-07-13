import { useCallback, useMemo, useRef, useState } from "react";
import PlanMarkupCanvas from "../components/plans/PlanMarkupCanvas";
import {
  buildPlanOverlayRecord,
  listProjectPlans,
  planIsMarkable,
  readPlanUploadFile,
  removePlanItem,
  saveProjectPlans,
  updateProjectPlan,
} from "./permits/permitPlanOverlayRegistry";
import { boundaryFromKmlGeometry, parseKmlGeometry } from "./permits/projectDrawingImport";
import { rasterizePdfDataUrl } from "../utils/planPdfRaster";
import { parseProjectBoundaryRing, centroidFromBoundaryRing } from "../utils/projectBoundary";
import ProjectKmlDropZone from "../components/ProjectKmlDropZone";

export default function ProjectSitePlanPanel({
  projectId,
  project,
  onProjectUpdate,
  selectedPlanId = "",
  onSelectPlanId,
  onPlansChanged,
  compact = false,
}) {
  const [plans, setPlans] = useState(() => listProjectPlans());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const planInputRef = useRef(null);

  const plansForProject = useMemo(
    () => (projectId ? plans.filter((p) => p.projectId === projectId) : []),
    [plans, projectId]
  );

  const selectedPlan = useMemo(
    () => plansForProject.find((p) => p.id === selectedPlanId) || plansForProject[0] || null,
    [plansForProject, selectedPlanId]
  );

  const boundaryRing = useMemo(() => (project ? parseProjectBoundaryRing(project) : null), [project]);

  const persistPlans = useCallback(
    (next) => {
      saveProjectPlans(next);
      setPlans(next);
      onPlansChanged?.();
    },
    [onPlansChanged]
  );

  const updatePlan = useCallback(
    (planId, updater) => {
      const next = updateProjectPlan(plans, planId, updater);
      persistPlans(next);
    },
    [plans, persistPlans]
  );

  const uploadPlan = async (file) => {
    if (!projectId || !file) return;
    setBusy(true);
    setMsg("");
    try {
      const raw = await readPlanUploadFile(file);
      let rasterDataUrl = "";
      if (String(raw.mimeType).toLowerCase().includes("pdf")) {
        setMsg("Rasterizing PDF for click marking…");
        rasterDataUrl = (await rasterizePdfDataUrl(raw.dataUrl)) || "";
      }
      const rec = buildPlanOverlayRecord({
        projectId,
        name: raw.name,
        mimeType: raw.mimeType,
        dataUrl: raw.dataUrl,
        uploadedBy: "local-user",
        rasterDataUrl,
      });
      const next = [rec, ...plans].slice(0, 120);
      persistPlans(next);
      onSelectPlanId?.(rec.id);
      setMsg(
        rasterDataUrl || !String(raw.mimeType).toLowerCase().includes("pdf")
          ? "Plan uploaded — click on the drawing to mark routes and zones."
          : "PDF saved — open link or re-upload as PNG/JPG for click marking."
      );
    } catch (e) {
      setMsg(e?.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const importKmlBoundary = async (file) => {
    if (!projectId || !file || !onProjectUpdate) return;
    setBusy(true);
    setMsg("");
    try {
      const text = await file.text();
      const geom = parseKmlGeometry(text);
      const boundary = boundaryFromKmlGeometry(geom, { sourceName: file.name });
      if (!boundary) {
        setMsg("No polygon boundary found in KML. Use a closed site boundary polygon.");
        return;
      }
      const centroid = centroidFromBoundaryRing(boundary.boundaryPoints);
      const hasCoords =
        Number.isFinite(parseFloat(String(project?.lat ?? "").trim())) &&
        Number.isFinite(parseFloat(String(project?.lng ?? "").trim()));
      onProjectUpdate({
        ...project,
        ...boundary,
        boundaryImportedAt: new Date().toISOString(),
        mapEscapeRoutes: (geom.lineStrings || []).map((line, idx) => ({
          id: `mer_${Date.now()}_${idx}`,
          name: line.name || `Route ${idx + 1}`,
          points: line.points.map((p) => ({ lat: p.lat, lng: p.lng })),
        })),
        ...(hasCoords || !centroid ? {} : { lat: String(centroid.lat), lng: String(centroid.lng) }),
      });
      const routeNote = geom.lineStrings?.length ? ` · ${geom.lineStrings.length} map route(s)` : "";
      setMsg(`Boundary imported (${boundary.boundaryPoints.length} points)${routeNote}. Visible on site map.`);
    } catch (e) {
      setMsg(e?.message || "KML import failed.");
    } finally {
      setBusy(false);
    }
  };

  const clearBoundary = () => {
    if (!onProjectUpdate || !project) return;
    if (!window.confirm("Remove site boundary from this project?")) return;
    onProjectUpdate({
      ...project,
      boundaryGeoJson: null,
      boundaryPoints: [],
      boundarySource: "",
      boundaryName: "",
    });
    setMsg("Boundary cleared.");
  };

  if (!projectId) {
    return (
      <div className="site-plan-panel site-plan-panel--empty">
        Select a project to upload KML boundaries and building plans.
      </div>
    );
  }

  return (
    <div className={`site-plan-panel${compact ? " site-plan-panel--compact" : ""}`}>
      <div className="site-plan-panel__head">
        <div>
          <div className="site-plan-panel__title">Site boundary &amp; plan markup</div>
          <div className="site-plan-panel__sub">
            Drag zones and escape routes on your floor plan. Assets and blocks auto-save — use Select / move to reposition. Legend builds itself from what you mark.
          </div>
        </div>
      </div>

      <ProjectKmlDropZone
        onFile={importKmlBoundary}
        busy={busy}
        compact
        buttonLabel="Import KML boundary"
        hint="Drop site boundary KML here"
      />

      <div className="site-plan-panel__actions">
        <input
          ref={planInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadPlan(f);
            e.target.value = "";
          }}
        />
        <button type="button" disabled={busy} onClick={() => planInputRef.current?.click()}>
          Upload plan (PDF / JPG)
        </button>
      </div>

      {boundaryRing ? (
        <div className="site-plan-panel__boundary-badge">
          Site boundary loaded · {boundaryRing.length} points
          {project?.boundaryName ? ` · ${project.boundaryName}` : ""}
          {" "}
          <button type="button" className="ghost" onClick={clearBoundary} style={{ marginLeft: 8 }}>
            Clear
          </button>
        </div>
      ) : (
        <div className="site-plan-panel__boundary-hint">No KML boundary yet — import a polygon from your survey or GIS export.</div>
      )}

      {plansForProject.length > 1 ? (
        <div className="site-plan-panel__plan-tabs">
          {plansForProject.map((p) => (
            <button
              key={p.id}
              type="button"
              className={selectedPlan?.id === p.id ? "active" : ""}
              onClick={() => onSelectPlanId?.(p.id)}
            >
              {p.name || "Plan"}
              {!planIsMarkable(p) ? " (PDF)" : ""}
            </button>
          ))}
        </div>
      ) : null}

      {selectedPlan ? (
        <>
          <div className="site-plan-panel__plan-meta">
            <strong>{selectedPlan.name}</strong>
            <span>
              {(selectedPlan.escapeRoutes || []).length} routes · {(selectedPlan.zoneBlocks || []).length} zones ·{" "}
              {(selectedPlan.emergencyAssets || []).length} assets
            </span>
          </div>
          <PlanMarkupCanvas
            plan={selectedPlan}
            compact={compact}
            onPlanChange={(next) => updatePlan(selectedPlan.id, () => next)}
          />
        </>
      ) : (
        <div className="site-plan-panel__empty-plan">No plan yet — upload a PDF or JPG building drawing to mark escape routes and zones.</div>
      )}

      {msg ? <div className="site-plan-panel__msg">{msg}</div> : null}
    </div>
  );
}
