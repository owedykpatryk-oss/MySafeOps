import { memo, useEffect, useMemo } from "react";
import { depthFromTwoWayTime } from "./gprReportHelpers";

function DepthScale({ velocityCmNs, timeWindowNs, height = 320 }) {
  const ticks = useMemo(() => {
    const v = Number(velocityCmNs) || 10;
    const maxNs = Number(timeWindowNs) || 80;
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const frac = i / steps;
      const ns = maxNs * frac;
      const depth = depthFromTwoWayTime(ns, v);
      return { frac, depth: depth != null ? depth.toFixed(2) : "—" };
    });
  }, [velocityCmNs, timeWindowNs]);

  return (
    <div className="app-gpr-lightbox__scale" style={{ height }}>
      <span className="app-gpr-lightbox__scale-title">Depth (m)</span>
      {ticks.map((t) => (
        <div key={t.frac} className="app-gpr-lightbox__tick" style={{ top: `${t.frac * 100}%` }}>
          <span>{t.depth}</span>
        </div>
      ))}
    </div>
  );
}

function GprRadargramLightbox({ radargram, velocityCmNs, timeWindowNs, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!radargram) return null;

  return (
    <div className="app-gpr-lightbox" role="dialog" aria-modal="true" aria-label="Radargram viewer" onClick={onClose}>
      <div className="app-gpr-lightbox__panel" onClick={(e) => e.stopPropagation()}>
        <header className="app-gpr-lightbox__header">
          <div>
            <strong>{radargram.label || "Radargram"}</strong>
            {radargram.lineRef ? <span className="app-gpr-lightbox__meta"> · {radargram.lineRef}</span> : null}
          </div>
          <button type="button" className="app-gpr-lightbox__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="app-gpr-lightbox__body">
          <div className="app-gpr-lightbox__frame">
            <div className="app-gpr-lightbox__grid" aria-hidden />
            <img src={radargram.dataUrl} alt={radargram.label || "Radargram"} />
          </div>
          <DepthScale velocityCmNs={velocityCmNs} timeWindowNs={timeWindowNs} />
        </div>
        <footer className="app-gpr-lightbox__footer">
          Velocity {velocityCmNs || 10} cm/ns · time window {timeWindowNs || "—"} ns · depth scale indicative only
        </footer>
      </div>
    </div>
  );
}

export default memo(GprRadargramLightbox);
