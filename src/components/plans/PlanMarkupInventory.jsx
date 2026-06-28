import { useState } from "react";
import { assetKindMeta, zoneKindMeta, PLAN_ROUTE_STYLE } from "../../utils/planMarkupMeta";

function itemCollection(type) {
  if (type === "route") return "escapeRoutes";
  if (type === "zone") return "zoneBlocks";
  return "emergencyAssets";
}

function SwatchMini({ type, kind }) {
  if (type === "route") {
    return <span className="plan-inv-card__swatch plan-inv-card__swatch--route" style={{ borderColor: PLAN_ROUTE_STYLE.stroke }} />;
  }
  if (type === "zone") {
    const meta = zoneKindMeta(kind);
    return (
      <span
        className="plan-inv-card__swatch plan-inv-card__swatch--zone"
        style={{ background: meta.fill, borderColor: meta.stroke }}
      />
    );
  }
  const meta = assetKindMeta(kind);
  return (
    <span className="plan-inv-card__swatch plan-inv-card__swatch--asset" style={{ background: meta.color }}>
      {meta.short}
    </span>
  );
}

export default function PlanMarkupInventory({ plan, selected, onSelect, onRemove, onRename }) {
  const [editing, setEditing] = useState(null);
  const routes = plan?.escapeRoutes || [];
  const zones = plan?.zoneBlocks || [];
  const assets = plan?.emergencyAssets || [];
  const total = routes.length + zones.length + assets.length;

  if (!total) return null;

  const cards = [
    ...routes.map((r, i) => ({
      id: r.id,
      type: "route",
      kind: "route",
      title: r.label || `Escape route ${i + 1}`,
      sub: `${(r.points || []).length || 2} points`,
    })),
    ...zones.map((z, i) => ({
      id: z.id,
      type: "zone",
      kind: z.kind,
      title: z.label || zoneKindMeta(z.kind).label || `Zone ${i + 1}`,
      sub: zoneKindMeta(z.kind).label,
    })),
    ...assets.map((a, i) => ({
      id: a.id,
      type: "asset",
      kind: a.kind,
      title: a.label || assetKindMeta(a.kind).label || `Asset ${i + 1}`,
      sub: assetKindMeta(a.kind).label,
    })),
  ];

  const commitRename = () => {
    if (!editing || !onRename) return;
    const label = String(editing.value || "").trim();
    if (label) onRename(itemCollection(editing.type), editing.id, label);
    setEditing(null);
  };

  return (
    <div className="plan-markup-inventory">
      <div className="plan-markup-inventory__head">
        <span className="plan-markup-inventory__title">On this plan ({total})</span>
        <span className="plan-markup-inventory__hint">Click to select · drag on map to move</span>
      </div>
      <div className="plan-markup-inventory__grid">
        {cards.map((c) => {
          const active = selected?.type === c.type && selected?.id === c.id;
          const isEditing = editing?.type === c.type && editing?.id === c.id;
          return (
            <div
              key={`${c.type}-${c.id}`}
              className={`plan-inv-card${active ? " plan-inv-card--active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isEditing) return;
                onSelect?.({ type: c.type, id: c.id });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (isEditing) return;
                  onSelect?.({ type: c.type, id: c.id });
                }
              }}
            >
              <SwatchMini type={c.type} kind={c.kind} />
              <div className="plan-inv-card__body">
                {isEditing ? (
                  <input
                    className="plan-inv-card__rename-input"
                    value={editing.value}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onBlur={commitRename}
                  />
                ) : (
                  <>
                    <div className="plan-inv-card__title">{c.title}</div>
                    <div className="plan-inv-card__sub">{c.sub}</div>
                  </>
                )}
              </div>
              <div className="plan-inv-card__actions">
                {onRename ? (
                  <button
                    type="button"
                    className="ghost"
                    title="Rename"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({ type: c.type, id: c.id, value: c.title });
                    }}
                  >
                    ✎
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost plan-inv-card__delete"
                  title="Remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.(itemCollection(c.type), c.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
