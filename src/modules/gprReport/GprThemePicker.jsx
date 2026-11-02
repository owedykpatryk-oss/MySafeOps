import { GPR_VISUAL_THEME_PRESETS, resolveGprVisualTheme } from "./gprVisualTheme.js";

export default function GprThemePicker({ value, organisation, onChange }) {
  const selectedKey = value?.presetKey || "brand";
  const resolved = resolveGprVisualTheme({ visualTheme: value }, organisation);

  const selectPreset = (preset) => {
    onChange({
      presetKey: preset.key,
      primaryColor: preset.primaryColor || value?.primaryColor || "",
      accentColor: preset.accentColor || value?.accentColor || "",
    });
  };

  return (
    <section className="app-gpr-theme-picker" aria-labelledby="gpr-theme-heading">
      <div className="app-gpr-theme-picker__heading">
        <div>
          <p className="app-gpr-theme-picker__eyebrow">Report appearance</p>
          <h3 id="gpr-theme-heading">Choose a visual theme</h3>
          <p>Applied to the cover, section accents, live preview and exported PDF.</p>
        </div>
        <div
          className="app-gpr-theme-picker__mini-cover"
          style={{ "--theme-primary": resolved.primary, "--theme-accent": resolved.accent }}
          aria-label={`${resolved.label} theme preview`}
        >
          <span>GPR</span>
          <strong>Survey report</strong>
          <i />
          <small>Technical issue</small>
        </div>
      </div>

      <div className="app-gpr-theme-picker__presets" role="radiogroup" aria-label="Report colour theme">
        {GPR_VISUAL_THEME_PRESETS.map((preset) => {
          const preview = resolveGprVisualTheme(
            { visualTheme: { ...value, presetKey: preset.key, primaryColor: preset.primaryColor, accentColor: preset.accentColor } },
            organisation
          );
          const active = selectedKey === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`app-gpr-theme-swatch${active ? " app-gpr-theme-swatch--active" : ""}`}
              onClick={() => selectPreset(preset)}
              title={preset.description}
            >
              <span className="app-gpr-theme-swatch__colours" aria-hidden>
                <i style={{ background: preview.primary }} />
                <i style={{ background: preview.accent }} />
              </span>
              <span>
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </span>
              {active ? <b aria-hidden>✓</b> : null}
            </button>
          );
        })}
      </div>

      {selectedKey === "custom" ? (
        <div className="app-gpr-theme-picker__custom">
          <label>
            <span>Primary colour</span>
            <span className="app-gpr-colour-input">
              <input
                type="color"
                value={resolved.primary}
                onChange={(event) => onChange({ ...value, presetKey: "custom", primaryColor: event.target.value })}
              />
              <code>{resolved.primary}</code>
            </span>
          </label>
          <label>
            <span>Accent colour</span>
            <span className="app-gpr-colour-input">
              <input
                type="color"
                value={resolved.accent}
                onChange={(event) => onChange({ ...value, presetKey: "custom", accentColor: event.target.value })}
              />
              <code>{resolved.accent}</code>
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}
