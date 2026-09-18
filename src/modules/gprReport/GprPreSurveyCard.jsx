import { SURFACE_TYPE_OPTIONS, MOISTURE_OPTIONS } from "./gprReportConstants";
import {
  GPR_SURVEY_OBJECTIVES,
  GPR_PRE_SURVEY_CHECKS,
  isGprPreSurveyStarted,
  toggleListKey,
  formatPreSurveyCoord,
  preSurveyGpsSourceLabel,
} from "./gprPreSurvey";

const chip = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${active ? "#5eead4" : "var(--color-border-secondary,#e2e8f0)"}`,
  background: active ? "#ccfbf1" : "var(--color-background-primary,#fff)",
  color: active ? "#0f766e" : "var(--color-text-primary)",
  minHeight: 44,
  cursor: "pointer",
});

export default function GprPreSurveyCard({
  preSurvey,
  busy,
  surveyor,
  onStartHere,
  onChange,
  onAddPhoto,
  onRemovePhoto,
  onBeforePickPhoto,
}) {
  const ps = preSurvey || {};
  const started = isGprPreSurveyStarted(ps);
  const dates = ps.surveyDates?.length ? ps.surveyDates : [""];
  const coord = formatPreSurveyCoord(ps.lat, ps.lng, ps.gpsAccuracyM);
  const weatherBits = [ps.weather?.description, ps.weather?.tempC != null ? `${ps.weather.tempC}°C` : "", ps.weather?.windMph != null ? `wind ~${ps.weather.windMph} mph` : ""]
    .filter(Boolean)
    .join(" · ");

  const patch = (partial) => onChange?.({ ...ps, ...partial });

  const setDateAt = (idx, value) => {
    const next = [...dates];
    next[idx] = value;
    patch({ surveyDates: next.filter(Boolean) });
  };

  return (
    <section className="app-gpr-start-card" id="gpr-start-here">
      <div className="app-gpr-start-card__head">
        <div>
          <div className="app-gpr-start-card__eyebrow">Pre-survey checks</div>
          <h3 className="app-gpr-start-card__title">Start here</h3>
          <p className="app-gpr-start-card__lead">
            Tap once on site. We stamp GPS and live weather at that moment, then you add general photos, surface, survey days and what you are looking for. All of it goes into the PDF.
          </p>
        </div>
        <button
          type="button"
          className="app-gpr-start-btn"
          disabled={!!busy}
          onClick={onStartHere}
        >
          {busy === "start" ? "Capturing…" : started ? "Re-stamp GPS & weather" : "Start here"}
        </button>
      </div>

      {started ? (
        <div className="app-gpr-start-stamp">
          <div>
            <span className="app-gpr-start-stamp__k">Started</span>
            <span className="app-gpr-start-stamp__v">
              {new Date(ps.startedAt).toLocaleString("en-GB")}
              {ps.startedBy || surveyor ? ` · ${ps.startedBy || surveyor}` : ""}
            </span>
          </div>
          <div>
            <span className="app-gpr-start-stamp__k">GPS</span>
            <span className="app-gpr-start-stamp__v">
              {coord || ps.gpsError || "Not recorded"}
              {ps.gpsSource ? ` · ${preSurveyGpsSourceLabel(ps.gpsSource)}` : ""}
            </span>
          </div>
          <div>
            <span className="app-gpr-start-stamp__k">Weather</span>
            <span className="app-gpr-start-stamp__v">{weatherBits || ps.weatherError || "Not recorded"}</span>
          </div>
        </div>
      ) : (
        <p className="app-gpr-start-card__hint">Create the job, then tap Start here when you are on site — not from the office.</p>
      )}

      <div className="app-gpr-start-block">
        <div className="app-gpr-start-block__label">Survey day(s)</div>
        <p className="app-gpr-start-block__hint">One-day job: leave a single date. Multi-day: add each field day.</p>
        <div className="app-gpr-start-dates">
          {dates.map((d, idx) => (
            <div key={`day-${idx}`} className="app-gpr-start-dates__row">
              <input
                type="date"
                value={d}
                onChange={(e) => setDateAt(idx, e.target.value)}
                aria-label={`Survey day ${idx + 1}`}
              />
              {dates.length > 1 ? (
                <button
                  type="button"
                  className="app-gpr-list-delete"
                  onClick={() => patch({ surveyDates: dates.filter((_, i) => i !== idx) })}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="app-gpr-start-add" onClick={() => patch({ surveyDates: [...dates.filter(Boolean), ""] })}>
            + Add another day
          </button>
        </div>
      </div>

      <div className="app-gpr-start-block">
        <div className="app-gpr-start-block__label">Surface / substrate</div>
        <div className="app-gpr-start-chips">
          {SURFACE_TYPE_OPTIONS.map((opt) => {
            const on = (ps.surfaceKeys || []).includes(opt.key);
            return (
              <label key={opt.key} style={chip(on)}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => patch({ surfaceKeys: toggleListKey(ps.surfaceKeys, opt.key) })}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        <label className="app-gpr-start-select">
          Ground moisture
          <select value={ps.moisture || "dry"} onChange={(e) => patch({ moisture: e.target.value })}>
            {MOISTURE_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="app-gpr-start-block">
        <div className="app-gpr-start-block__label">What are we looking for?</div>
        <div className="app-gpr-start-chips">
          {GPR_SURVEY_OBJECTIVES.map((opt) => {
            const on = (ps.objectives || []).includes(opt.key);
            return (
              <label key={opt.key} style={chip(on)}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => patch({ objectives: toggleListKey(ps.objectives, opt.key) })}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        <textarea
          className="app-gpr-start-notes"
          rows={2}
          placeholder="Notes — e.g. pile caps under the east slab, suspected void by the chamber…"
          value={ps.objectiveNotes || ""}
          onChange={(e) => patch({ objectiveNotes: e.target.value })}
        />
      </div>

      <div className="app-gpr-start-block">
        <div className="app-gpr-start-block__label">On-site checks</div>
        <div className="app-gpr-start-chips">
          {GPR_PRE_SURVEY_CHECKS.map((opt) => {
            const on = !!ps.siteChecks?.[opt.key];
            return (
              <label key={opt.key} style={chip(on)}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    patch({ siteChecks: { ...(ps.siteChecks || {}), [opt.key]: e.target.checked } })
                  }
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="app-gpr-start-block">
        <div className="app-gpr-start-block__label">General site photographs</div>
        <p className="app-gpr-start-block__hint">Overview shots of the scan area, not radargrams. These print in the report.</p>
        <label className="app-gpr-start-photo-btn" onPointerDown={() => onBeforePickPhoto?.()}>
          + Add photo
          <input
            type="file"
            accept="image/*,.heic,.heif"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onAddPhoto?.(file);
            }}
          />
        </label>
        {(ps.photos || []).length ? (
          <div className="app-gpr-start-photos">
            {ps.photos.map((ph) => (
              <div key={ph.id} className="app-gpr-start-photo">
                {ph.dataUrl ? <img src={ph.dataUrl} alt="" /> : null}
                <input
                  value={ph.caption || ""}
                  placeholder="Caption"
                  onChange={(e) =>
                    patch({
                      photos: ps.photos.map((p) => (p.id === ph.id ? { ...p, caption: e.target.value } : p)),
                    })
                  }
                />
                <button type="button" className="app-gpr-list-delete" onClick={() => onRemovePhoto?.(ph.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <label className="app-gpr-start-select">
        Extra field notes
        <textarea
          className="app-gpr-start-notes"
          rows={2}
          placeholder="Access, parked vehicles, anything the office should see in the report…"
          value={ps.notes || ""}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </label>
    </section>
  );
}
