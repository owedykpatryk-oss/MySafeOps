import { memo } from "react";

const MODE_SHAPES = {
  grid: { rows: 4, cols: 4, label: "Grid scan" },
  longitudinal: { rows: 1, cols: 6, label: "Longitudinal lines" },
  cross_section: { rows: 6, cols: 1, label: "Cross-section" },
  route: { rows: 2, cols: 5, label: "Route / corridor" },
  "3d_array": { rows: 3, cols: 3, label: "3D array" },
};

function GprAcquisitionDiagram({ scanMode, lineSpacingM, lineSpacingLabel }) {
  const shape = MODE_SHAPES[scanMode] || MODE_SHAPES.grid;
  const cells = shape.rows * shape.cols;

  return (
    <div className="app-gpr-acq-diagram">
      <div className="app-gpr-acq-diagram__head">
        <strong>{shape.label}</strong>
        {lineSpacingM ? <span>{lineSpacingLabel || "Line spacing"}: {lineSpacingM} m</span> : null}
      </div>
      <div
        className="app-gpr-acq-diagram__grid"
        style={{ gridTemplateColumns: `repeat(${shape.cols}, 1fr)`, gridTemplateRows: `repeat(${shape.rows}, 1fr)` }}
      >
        {Array.from({ length: cells }, (_, i) => (
          <div key={i} className="app-gpr-acq-diagram__cell" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default memo(GprAcquisitionDiagram);
