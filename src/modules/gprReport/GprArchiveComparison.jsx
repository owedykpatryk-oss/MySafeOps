import { useState } from "react";

export function chooseGprArchiveComparison(frames, selectedRelease = "") {
  const available = Array.isArray(frames) ? frames.filter((frame) => frame?.tileUrl && frame?.marker) : [];
  const satellite = available.filter((frame) => frame.kind !== "historic_map")
    .sort((a, b) => String(a.releaseDates?.at(-1) || a.date).localeCompare(String(b.releaseDates?.at(-1) || b.date)));
  const latest = satellite.at(-1);
  if (!latest) return null;
  const choices = available.filter((frame) => frame.release !== latest.release && frame.zoom === latest.zoom && frame.col === latest.col && frame.row === latest.row);
  if (!choices.length) return null;
  return { latest, choices, historic: choices.find((frame) => frame.release === selectedRelease) || choices[0] };
}

export default function GprArchiveComparison({ frames }) {
  const [selectedRelease, setSelectedRelease] = useState("");
  const [reveal, setReveal] = useState(50);
  const comparison = chooseGprArchiveComparison(frames, selectedRelease);
  if (!comparison) return null;
  const { latest, historic, choices } = comparison;
  const leftLabel = historic.kind === "historic_map" ? historic.title : `World Imagery release ${historic.releaseDates?.[0] || historic.date}`;
  const rightLabel = `Latest available mosaic release ${latest.releaseDates?.at(-1) || latest.date}`;
  const marker = latest.marker;

  return (
    <section className="app-gpr-archive-compare" aria-label="Compare archive imagery at the survey coordinate">
      <div className="app-gpr-archive-compare__head">
        <div>
          <strong>Then and latest available</strong>
          <p>Aligned to the same survey coordinate. Release dates do not establish when a feature was built or removed.</p>
        </div>
        <label>
          Historic view
          <select value={historic.release} onChange={(event) => setSelectedRelease(event.target.value)}>
            {choices.map((frame) => <option key={frame.release} value={frame.release}>{frame.title || frame.releaseDates?.[0] || frame.date}</option>)}
          </select>
        </label>
      </div>
      <div className="app-gpr-archive-compare__image" role="img" aria-label={`${leftLabel} compared with ${rightLabel}`}>
        <img src={latest.tileUrl} alt="" />
        <img className="app-gpr-archive-compare__historic" src={historic.tileUrl} alt="" style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }} />
        <span className="app-gpr-archive-compare__divider" style={{ left: `${reveal}%` }} />
        <span className="app-gpr-archive-card__cross" style={{ left: `${(marker.x / 256) * 100}%`, top: `${(marker.y / 256) * 100}%` }} />
        <span className="app-gpr-archive-compare__label app-gpr-archive-compare__label--left">Then</span>
        <span className="app-gpr-archive-compare__label app-gpr-archive-compare__label--right">Latest available</span>
      </div>
      <input type="range" min="0" max="100" value={reveal} aria-label="Reveal historic image" onChange={(event) => setReveal(Number(event.target.value))} />
      <div className="app-gpr-archive-compare__captions"><span>{leftLabel}</span><span>{rightLabel}</span></div>
    </section>
  );
}
