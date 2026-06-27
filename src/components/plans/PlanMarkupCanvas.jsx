import { useCallback, useRef, useState } from "react";
import PlanOverlaySvg, { EmergencyAssetMarkers } from "./PlanOverlaySvg";
import {
  addPlanEmergencyAsset,
  addPlanEscapeRoute,
  addPlanZoneBlock,
  clampPercent,
  planDisplaySrc,
} from "../../modules/permits/permitPlanOverlayRegistry";

const ASSET_KINDS = [
  { id: "muster", label: "Muster point" },
  { id: "extinguisher", label: "Fire extinguisher" },
  { id: "first_aid", label: "First aid" },
  { id: "shutoff", label: "Shut-off / isolation" },
  { id: "exit", label: "Emergency exit" },
];

const ZONE_KINDS = [
  { id: "exclusion", label: "Exclusion / no-go" },
  { id: "hazard", label: "Hazard zone" },
  { id: "work", label: "Work area" },
  { id: "muster", label: "Assembly" },
];

function clientToPercent(el, clientX, clientY) {
  if (!el) return { x: 50, y: 50 };
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 50, y: 50 };
  return {
    x: clampPercent(((clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

export default function PlanMarkupCanvas({ plan, onPlanChange, compact = false }) {
  const surfaceRef = useRef(null);
  const [tool, setTool] = useState("escape_route");
  const [routePoints, setRoutePoints] = useState([]);
  const [zoneDrag, setZoneDrag] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [routeLabel, setRouteLabel] = useState("Primary escape route");
  const [assetKind, setAssetKind] = useState("muster");
  const [assetLabel, setAssetLabel] = useState("");
  const [zoneKind, setZoneKind] = useState("exclusion");
  const [zoneLabel, setZoneLabel] = useState("");

  const imageSrc = planDisplaySrc(plan);

  const commitPlan = useCallback(
    (next) => {
      onPlanChange?.(next);
    },
    [onPlanChange]
  );

  const finishRoute = () => {
    if (routePoints.length < 2) return;
    const next = addPlanEscapeRoute(plan, { label: routeLabel, points: routePoints });
    commitPlan(next);
    setRoutePoints([]);
  };

  const cancelRoute = () => setRoutePoints([]);

  const onSurfacePointerDown = (e) => {
    if (!plan || !imageSrc) return;
    const pt = clientToPercent(surfaceRef.current, e.clientX, e.clientY);

    if (tool === "escape_route") {
      setRoutePoints((prev) => [...prev, pt]);
      return;
    }
    if (tool === "zone") {
      setZoneDrag({ start: pt, current: pt });
      return;
    }
    if (tool === "asset") {
      setPendingPoint(pt);
    }
  };

  const onSurfacePointerMove = (e) => {
    if (!zoneDrag) return;
    const pt = clientToPercent(surfaceRef.current, e.clientX, e.clientY);
    setZoneDrag((z) => (z ? { ...z, current: pt } : z));
  };

  const onSurfacePointerUp = () => {
    if (!zoneDrag || tool !== "zone") return;
    const { start, current } = zoneDrag;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    setZoneDrag(null);
    if (w < 1.5 || h < 1.5) return;
    const next = addPlanZoneBlock(plan, { x, y, w, h, label: zoneLabel, kind: zoneKind });
    commitPlan(next);
    setZoneLabel("");
  };

  const confirmAsset = () => {
    if (!pendingPoint) return;
    const next = addPlanEmergencyAsset(plan, {
      kind: assetKind,
      x: pendingPoint.x,
      y: pendingPoint.y,
      label: assetLabel,
    });
    commitPlan(next);
    setPendingPoint(null);
    setAssetLabel("");
  };

  const draftZone =
    zoneDrag && zoneDrag.start && zoneDrag.current
      ? {
          x: Math.min(zoneDrag.start.x, zoneDrag.current.x),
          y: Math.min(zoneDrag.start.y, zoneDrag.current.y),
          w: Math.abs(zoneDrag.current.x - zoneDrag.start.x),
          h: Math.abs(zoneDrag.current.y - zoneDrag.start.y),
        }
      : null;

  if (!plan) {
    return <div className="plan-markup-empty">Select or upload a plan to start marking.</div>;
  }

  if (!imageSrc) {
    return (
      <div className="plan-markup-empty">
        <p>
          PDF preview is not ready for click marking.{" "}
          <a href={plan.dataUrl} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        </p>
        <p style={{ fontSize: 12, marginTop: 8, color: "var(--color-text-secondary)" }}>
          Re-upload after rasterization, or export page 1 as PNG/JPG and upload that instead.
        </p>
      </div>
    );
  }

  return (
    <div className={`plan-markup-wrap${compact ? " plan-markup-wrap--compact" : ""}`}>
      <div className="plan-markup-toolbar" role="toolbar" aria-label="Plan markup tools">
        <button type="button" className={tool === "escape_route" ? "active" : ""} onClick={() => setTool("escape_route")}>
          Escape route
        </button>
        <button type="button" className={tool === "zone" ? "active" : ""} onClick={() => setTool("zone")}>
          Block / zone
        </button>
        <button type="button" className={tool === "asset" ? "active" : ""} onClick={() => setTool("asset")}>
          Emergency asset
        </button>
      </div>

      {tool === "escape_route" ? (
        <div className="plan-markup-subbar">
          <input
            type="text"
            value={routeLabel}
            onChange={(e) => setRouteLabel(e.target.value)}
            placeholder="Route label"
            aria-label="Route label"
          />
          <span className="plan-markup-hint">Click points along the route, then finish.</span>
          <button type="button" disabled={routePoints.length < 2} onClick={finishRoute}>
            Finish route ({routePoints.length})
          </button>
          {routePoints.length ? (
            <button type="button" className="ghost" onClick={cancelRoute}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {tool === "zone" ? (
        <div className="plan-markup-subbar">
          <select value={zoneKind} onChange={(e) => setZoneKind(e.target.value)} aria-label="Zone type">
            {ZONE_KINDS.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={zoneLabel}
            onChange={(e) => setZoneLabel(e.target.value)}
            placeholder="Zone label (optional)"
            aria-label="Zone label"
          />
          <span className="plan-markup-hint">Drag a rectangle on the plan.</span>
        </div>
      ) : null}

      {tool === "asset" ? (
        <div className="plan-markup-subbar">
          <select value={assetKind} onChange={(e) => setAssetKind(e.target.value)} aria-label="Asset type">
            {ASSET_KINDS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={assetLabel}
            onChange={(e) => setAssetLabel(e.target.value)}
            placeholder="Label (optional)"
            aria-label="Asset label"
          />
          <span className="plan-markup-hint">Click on the plan to place.</span>
        </div>
      ) : null}

      <div
        ref={surfaceRef}
        className="plan-markup-surface"
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={onSurfacePointerUp}
        onPointerLeave={onSurfacePointerUp}
        style={{
          cursor:
            tool === "zone" ? "crosshair" : tool === "escape_route" ? "crosshair" : tool === "asset" ? "copy" : "default",
        }}
      >
        <img src={imageSrc} alt={plan.name || "Site plan"} draggable={false} />
        <PlanOverlaySvg plan={plan} draftRoutePoints={routePoints} draftZone={draftZone} />
        <EmergencyAssetMarkers plan={plan} />
        <div className="plan-markup-legend">
          <div>Blue dashed: escape route</div>
          <div>Red fill: blocked / hazard zone</div>
          <div>Green square: emergency asset</div>
        </div>
      </div>

      {pendingPoint ? (
        <div className="plan-markup-popover">
          <span>
            Place {assetKind} at {pendingPoint.x.toFixed(1)}%, {pendingPoint.y.toFixed(1)}%?
          </span>
          <button type="button" onClick={confirmAsset}>
            Place
          </button>
          <button type="button" className="ghost" onClick={() => setPendingPoint(null)}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
