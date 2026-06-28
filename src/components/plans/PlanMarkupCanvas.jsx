import { useCallback, useEffect, useRef, useState } from "react";
import PlanOverlaySvg, { EmergencyAssetMarkers } from "./PlanOverlaySvg";
import PlanMarkupLegend from "./PlanMarkupLegend";
import PlanMarkupInventory from "./PlanMarkupInventory";
import {
  addPlanEmergencyAsset,
  addPlanEscapeRoute,
  addPlanZoneBlock,
  clampPercent,
  movePlanEmergencyAsset,
  movePlanZoneBlock,
  planDisplaySrc,
  removePlanItem,
  renamePlanItem,
  updatePlanRoutePoints,
} from "../../modules/permits/permitPlanOverlayRegistry";
import {
  PLAN_ASSET_KINDS,
  PLAN_MARKUP_PRESETS,
  PLAN_ZONE_KINDS,
} from "../../utils/planMarkupMeta";

const TOOLS = [
  { id: "select", label: "Select / move" },
  { id: "escape_route", label: "Escape route" },
  { id: "zone", label: "Block / zone" },
  { id: "asset", label: "Emergency asset" },
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

function collectionKey(type) {
  if (type === "route") return "escapeRoutes";
  if (type === "zone") return "zoneBlocks";
  return "emergencyAssets";
}

export default function PlanMarkupCanvas({ plan, onPlanChange, compact = false, extraOverlay = null }) {
  const surfaceRef = useRef(null);
  const undoStack = useRef([]);
  const [tool, setTool] = useState("select");
  const [routePoints, setRoutePoints] = useState([]);
  const [zoneDrag, setZoneDrag] = useState(null);
  const [routeLabel, setRouteLabel] = useState("Primary escape route");
  const [assetKind, setAssetKind] = useState("muster");
  const [assetLabel, setAssetLabel] = useState("");
  const [zoneKind, setZoneKind] = useState("exclusion");
  const [zoneLabel, setZoneLabel] = useState("");
  const [selected, setSelected] = useState(null);
  const [drag, setDrag] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [undoCount, setUndoCount] = useState(0);

  const imageSrc = planDisplaySrc(plan);
  const interactiveSelect = tool === "select";

  const commitPlan = useCallback(
    (next, { skipUndo = false } = {}) => {
      if (!skipUndo && plan) {
        undoStack.current = [...undoStack.current.slice(-24), plan];
        setUndoCount(undoStack.current.length);
      }
      onPlanChange?.(next);
      setSavedAt(Date.now());
    },
    [onPlanChange, plan]
  );

  const undo = () => {
    const prev = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (prev) {
      onPlanChange?.(prev);
      setSavedAt(Date.now());
      setSelected(null);
    }
  };

  const finishRoute = useCallback(() => {
    if (routePoints.length < 2 || !plan) return;
    const next = addPlanEscapeRoute(plan, { label: routeLabel, points: routePoints });
    commitPlan(next);
    setRoutePoints([]);
    setTool("select");
  }, [routePoints, plan, routeLabel, commitPlan]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setRoutePoints([]);
        setZoneDrag(null);
        setDrag(null);
        setSelected(null);
      }
      if ((e.key === "Enter" || e.key === " ") && tool === "escape_route" && routePoints.length >= 2) {
        e.preventDefault();
        finishRoute();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !isEditableSurfaceTarget(e.target)) {
        e.preventDefault();
        const key = collectionKey(selected.type);
        commitPlan(removePlanItem(plan, key, selected.id));
        setSelected(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, routePoints, selected, plan, finishRoute, commitPlan]);

  const applyDrag = useCallback(
    (clientX, clientY) => {
      if (!drag || !plan) return;
      const pt = clientToPercent(surfaceRef.current, clientX, clientY);

      if (drag.kind === "asset") {
        commitPlan(movePlanEmergencyAsset(plan, drag.id, pt.x, pt.y), { skipUndo: true });
        return;
      }
      if (drag.kind === "zone") {
        const z = (plan.zoneBlocks || []).find((x) => x.id === drag.id);
        if (!z) return;
        const dx = pt.x - drag.startPt.x;
        const dy = pt.y - drag.startPt.y;
        commitPlan(
          movePlanZoneBlock(plan, drag.id, {
            x: clampPercent(drag.orig.x + dx),
            y: clampPercent(drag.orig.y + dy),
          }),
          { skipUndo: true }
        );
        return;
      }
      if (drag.kind === "zone-resize") {
        const z = (plan.zoneBlocks || []).find((x) => x.id === drag.id);
        if (!z) return;
        commitPlan(
          movePlanZoneBlock(plan, drag.id, {
            w: Math.max(2, pt.x - z.x),
            h: Math.max(2, pt.y - z.y),
          }),
          { skipUndo: true }
        );
        return;
      }
      if (drag.kind === "route-point") {
        const r = (plan.escapeRoutes || []).find((x) => x.id === drag.id);
        if (!r?.points) return;
        const pts = r.points.map((p, i) => (i === drag.pointIndex ? { x: pt.x, y: pt.y } : p));
        commitPlan(updatePlanRoutePoints(plan, drag.id, pts), { skipUndo: true });
      }
    },
    [drag, plan, commitPlan]
  );

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (e) => applyDrag(e.clientX, e.clientY);
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, applyDrag]);

  const startDrag = (dragState) => {
    if (plan) {
      undoStack.current = [...undoStack.current.slice(-24), plan];
      setUndoCount(undoStack.current.length);
    }
    setDrag(dragState);
  };

  const onItemPointerDown = (e, kind, id, pointIndex = null) => {
    e.stopPropagation();
    e.preventDefault();
    if (kind === "zone-resize") {
      setSelected({ type: "zone", id });
      startDrag({ kind: "zone-resize", id });
      return;
    }
    const type = kind === "route-point" ? "route" : kind;
    setSelected({ type, id });
    if (tool !== "select") return;

    const pt = clientToPercent(surfaceRef.current, e.clientX, e.clientY);
    if (kind === "zone") {
      const z = (plan.zoneBlocks || []).find((x) => x.id === id);
      if (z) startDrag({ kind: "zone", id, startPt: pt, orig: { x: z.x, y: z.y } });
    } else if (kind === "route-point") {
      startDrag({ kind: "route-point", id, pointIndex });
    }
  };

  const onAssetPointerDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected({ type: "asset", id });
    if (tool === "select") startDrag({ kind: "asset", id });
  };

  const onSurfacePointerDown = (e) => {
    if (!plan || !imageSrc) return;
    const pt = clientToPercent(surfaceRef.current, e.clientX, e.clientY);

    if (tool === "select") {
      setSelected(null);
      return;
    }
    if (tool === "escape_route") {
      if (e.detail >= 2 && routePoints.length >= 2) {
        finishRoute();
        return;
      }
      setRoutePoints((prev) => [...prev, pt]);
      return;
    }
    if (tool === "zone") {
      setZoneDrag({ start: pt, current: pt });
      return;
    }
    if (tool === "asset") {
      const next = addPlanEmergencyAsset(plan, {
        kind: assetKind,
        x: pt.x,
        y: pt.y,
        label: assetLabel || undefined,
      });
      commitPlan(next);
      setSelected({ type: "asset", id: next.emergencyAssets[next.emergencyAssets.length - 1].id });
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
    const created = next.zoneBlocks[next.zoneBlocks.length - 1];
    setSelected({ type: "zone", id: created.id });
    setZoneLabel("");
    setTool("select");
  };

  const applyPreset = (preset) => {
    setTool(preset.tool);
    if (preset.routeLabel) setRouteLabel(preset.routeLabel);
    if (preset.zoneKind) setZoneKind(preset.zoneKind);
    if (preset.zoneLabel) setZoneLabel(preset.zoneLabel);
    if (preset.assetKind) setAssetKind(preset.assetKind);
    if (preset.assetLabel) setAssetLabel(preset.assetLabel);
    if (preset.tool === "escape_route") setRoutePoints([]);
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

  const savedLabel =
    savedAt && Date.now() - savedAt < 4000 ? "Saved" : plan?.markupUpdatedAt ? "Saved locally" : null;

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
      <div className="plan-markup-top">
        <div className="plan-markup-toolbar" role="toolbar" aria-label="Plan markup tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tool === t.id ? "active" : ""}
              onClick={() => {
                setTool(t.id);
                if (t.id !== "escape_route") setRoutePoints([]);
              }}
            >
              {t.label}
            </button>
          ))}
          <span className="plan-markup-save">
            {savedLabel ? <span className="plan-markup-save__ok">{savedLabel}</span> : null}
            <button type="button" className="ghost" disabled={!undoCount} onClick={undo} title="Undo (Ctrl+Z)">
              Undo
            </button>
          </span>
        </div>

        <div className="plan-markup-presets" aria-label="Quick add">
          {PLAN_MARKUP_PRESETS.map((p) => (
            <button key={p.id} type="button" className="plan-markup-preset" onClick={() => applyPreset(p)}>
              + {p.label}
            </button>
          ))}
        </div>
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
          <span className="plan-markup-hint">Click waypoints · double-click or Finish to save route</span>
          <button type="button" disabled={routePoints.length < 2} onClick={finishRoute}>
            Finish route ({routePoints.length})
          </button>
          {routePoints.length ? (
            <button type="button" className="ghost" onClick={() => setRoutePoints([])}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {tool === "zone" ? (
        <div className="plan-markup-subbar">
          <select value={zoneKind} onChange={(e) => setZoneKind(e.target.value)} aria-label="Zone type">
            {PLAN_ZONE_KINDS.map((z) => (
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
          <span className="plan-markup-hint">Drag a rectangle on the plan — auto-saves when you release.</span>
        </div>
      ) : null}

      {tool === "asset" ? (
        <div className="plan-markup-subbar">
          <select value={assetKind} onChange={(e) => setAssetKind(e.target.value)} aria-label="Asset type">
            {PLAN_ASSET_KINDS.map((a) => (
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
          <span className="plan-markup-hint">Click on the plan — placed instantly, drag to move in Select mode.</span>
        </div>
      ) : null}

      {tool === "select" && selected ? (
        <div className="plan-markup-subbar plan-markup-subbar--select">
          <span>Selected — drag to reposition · Delete to remove</span>
          <button
            type="button"
            className="ghost plan-markup-delete"
            onClick={() => {
              commitPlan(removePlanItem(plan, collectionKey(selected.type), selected.id));
              setSelected(null);
            }}
          >
            Remove selected
          </button>
        </div>
      ) : null}

      <div className="plan-markup-stage">
        <div
          ref={surfaceRef}
          className="plan-markup-surface"
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
          onPointerLeave={onSurfacePointerUp}
          style={{
            cursor:
              tool === "zone" || tool === "escape_route" ? "crosshair" : tool === "asset" ? "copy" : "default",
          }}
        >
          <img src={imageSrc} alt={plan.name || "Site plan"} draggable={false} />
          <PlanOverlaySvg
            plan={plan}
            interactive={interactiveSelect}
            draftRoutePoints={routePoints}
            draftZone={draftZone}
            selected={selected}
            onItemPointerDown={onItemPointerDown}
          />
          <EmergencyAssetMarkers
            plan={plan}
            interactive={interactiveSelect}
            selected={selected}
            onAssetPointerDown={onAssetPointerDown}
          />
          {extraOverlay}
        </div>
        <PlanMarkupLegend plan={plan} compact={compact} />
      </div>

      <PlanMarkupInventory
        plan={plan}
        selected={selected}
        onSelect={(sel) => {
          setSelected(sel);
          setTool("select");
        }}
        onRemove={(key, id) => {
          commitPlan(removePlanItem(plan, key, id));
          if (selected?.id === id) setSelected(null);
        }}
        onRename={(key, id, label) => commitPlan(renamePlanItem(plan, key, id, label))}
      />
    </div>
  );
}

function isEditableSurfaceTarget(target) {
  if (!target || typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest?.("input, textarea, select, [contenteditable='true']"));
}
