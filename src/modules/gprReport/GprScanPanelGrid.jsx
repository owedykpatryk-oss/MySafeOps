import { memo } from "react";
import { SCAN_SIGNAL_QUALITY } from "./gprReportConstants";

const QUALITY_COLOUR = {
  good: "#0d9488",
  moderate: "#d97706",
  disturbed: "#ea580c",
  uninterpretable: "#94a3b8",
};

function GprScanPanelGrid({ panels = [], onSelectPanel }) {
  if (!panels.length) return null;

  return (
    <div className="app-gpr-panel-grid">
      <div className="app-gpr-panel-grid__head">Coverage mosaic</div>
      <div className="app-gpr-panel-grid__tiles">
        {panels.map((p, i) => {
          const q = SCAN_SIGNAL_QUALITY.find((x) => x.key === p.signalQuality);
          const colour = QUALITY_COLOUR[p.signalQuality] || "#0c447c";
          return (
            <button
              key={p.id || i}
              type="button"
              className="app-gpr-panel-grid__tile"
              style={{ borderColor: colour, background: `${colour}18` }}
              title={q?.label || p.panelRef}
              onClick={() => onSelectPanel?.(p)}
            >
              <span className="app-gpr-panel-grid__ref">{p.panelRef || `P${i + 1}`}</span>
              <span className="app-gpr-panel-grid__meta">
                {p.gridSizeW && p.gridSizeH ? `${p.gridSizeW}×${p.gridSizeH} m` : "—"}
              </span>
              <span className="app-gpr-panel-grid__dot" style={{ background: colour }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(GprScanPanelGrid);
