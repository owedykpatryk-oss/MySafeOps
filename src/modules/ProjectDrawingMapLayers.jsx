const LAYER_DEFS = [
  { id: "markers", label: "Markers" },
  { id: "boundary", label: "Boundary" },
  { id: "areas", label: "Areas" },
  { id: "escapeRoutes", label: "Escape routes" },
  { id: "hospitalRoute", label: "A&E route" },
];

export default function ProjectDrawingMapLayers({ layers, onChange, disabled = false }) {
  return (
    <div className="pde-map-layers" role="group" aria-label="Map layers">
      <span className="pde-map-layers__label">Layers</span>
      {LAYER_DEFS.map((def) => (
        <label key={def.id} className="pde-map-layers__item">
          <input
            type="checkbox"
            checked={Boolean(layers?.[def.id])}
            disabled={disabled}
            onChange={(e) => onChange?.(def.id, e.target.checked)}
          />
          {def.label}
        </label>
      ))}
    </div>
  );
}

export const DEFAULT_PDE_MAP_LAYERS = {
  markers: true,
  boundary: true,
  areas: true,
  escapeRoutes: true,
  hospitalRoute: true,
};
