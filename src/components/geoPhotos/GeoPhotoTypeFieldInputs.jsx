import { ms } from "../../utils/moduleStyles";
import { geoPhotoTypeFields, geoPhotoTypePrompt } from "../../utils/geoPhotoTypeFields";

/**
 * The questions a given photo type asks, rendered as one panel.
 * Shared by the capture wizard and the detail editor so both stay in step.
 */
export default function GeoPhotoTypeFieldInputs({ type, value, onChange, title = "Observations", showPrompt = true }) {
  const fields = geoPhotoTypeFields(type);
  const prompt = showPrompt ? geoPhotoTypePrompt(type) : "";
  const details = value && typeof value === "object" ? value : {};
  const inputs = fields.filter((f) => f.kind !== "toggle");
  const toggles = fields.filter((f) => f.kind === "toggle");

  const set = (key, next) => onChange({ ...details, [key]: next });

  return (
    <div className="geo-photo-capture__panel" style={{ marginBottom: 12 }}>
      <div className="geo-photo-capture__panel-title">{title}</div>
      {prompt ? <p className="geo-photo-capture__hint">{prompt}</p> : null}
      {inputs.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {inputs.map((field) => (
            <label key={field.key} className="geo-photos-toolbar__field">
              {field.unit ? `${field.label} (${field.unit})` : field.label}
              {field.kind === "select" ? (
                <select value={details[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)} style={ms.inp}>
                  <option value="">—</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.kind === "number" ? "number" : "text"}
                  step={field.kind === "number" ? (field.step ?? 0.1) : undefined}
                  min={field.kind === "number" ? 0 : undefined}
                  value={details[field.key] ?? ""}
                  placeholder={field.placeholder || ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  style={ms.inp}
                />
              )}
            </label>
          ))}
        </div>
      ) : null}
      {toggles.length ? (
        <div className="geo-photo-capture__tickboxes">
          {toggles.map((field) => (
            <label
              key={field.key}
              className={`geo-photos-card__report ${details[field.key] ? "geo-photos-card__report--on" : ""}`}
            >
              <input
                type="checkbox"
                checked={details[field.key] === true}
                onChange={(e) => set(field.key, e.target.checked)}
              />
              {field.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
