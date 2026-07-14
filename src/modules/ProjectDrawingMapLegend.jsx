/**
 * Build legend rows for map PNG export.
 */
export function buildMapLegendItems({
  markerTypes = [],
  typeCounts = {},
  hasBoundary = false,
  showBoundary = true,
  escapeRouteCount = 0,
  showEscapeRoutes = true,
  showHospitalRoute = false,
  showHospitalLayer = true,
}) {
  const items = [];
  if (hasBoundary && showBoundary) {
    items.push({ color: "#0d9488", label: "Site boundary", kind: "line" });
  }
  for (const meta of markerTypes) {
    const count = typeCounts[meta.id] ?? 0;
    if (count <= 0) continue;
    items.push({
      color: meta.color,
      label: `${meta.label} (${count})`,
      kind: meta.shape || "circle",
    });
  }
  if (escapeRouteCount > 0 && showEscapeRoutes) {
    items.push({
      color: "#0C447C",
      label: `Escape route${escapeRouteCount > 1 ? "s" : ""} (${escapeRouteCount})`,
      kind: "line",
    });
  }
  if (showHospitalRoute && showHospitalLayer) {
    items.push({ color: "#dc2626", label: "Nearest A&E route", kind: "line" });
  }
  return items;
}

function Swatch({ item }) {
  if (item.kind === "line") {
    return (
      <span
        className="pde-map-legend__swatch pde-map-legend__swatch--line"
        style={{ background: item.color }}
        aria-hidden
      />
    );
  }
  const radius = item.kind === "square" ? 3 : item.kind === "diamond" ? 2 : "50%";
  return (
    <span
      className="pde-map-legend__swatch"
      style={{ background: item.color, borderRadius: radius }}
      aria-hidden
    />
  );
}

export default function ProjectDrawingMapLegend({ projectName = "", items = [] }) {
  if (!items.length) return null;
  return (
    <div className="pde-map-legend" aria-label="Map legend">
      <div className="pde-map-legend__title">{projectName ? String(projectName).slice(0, 48) : "Site map"}</div>
      <ul className="pde-map-legend__list">
        {items.map((item) => (
          <li key={`${item.label}-${item.color}`} className="pde-map-legend__item">
            <Swatch item={item} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
