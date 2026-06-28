import { useEffect, useState } from "react";
import { ms } from "../utils/moduleStyles";

const ss = ms;

/**
 * Lightweight modal form — shared across modules (permits, RAMS, etc.).
 */
export default function SimpleFormDialog({
  open,
  title,
  description,
  submitLabel = "Save",
  fields = [],
  onSubmit,
  onClose,
  maxWidth = 520,
  zIndex = 60,
}) {
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!open) return;
    const init = {};
    fields.forEach((f) => {
      init[f.name] = f.defaultValue ?? "";
    });
    setValues(init);
    // Intentionally only when dialog opens — fields are read from props at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const setField = (name, val) => setValues((prev) => ({ ...prev, [name]: val }));

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    for (const f of fields) {
      if (f.required && !String(values[f.name] || "").trim()) return;
    }
    onSubmit?.(values);
  };

  return (
    <div
      className="app-module-dialog-overlay"
      style={{ zIndex }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simple-form-dialog-title"
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--color-background-primary,#fff)",
          borderRadius: 10,
          border: "1px solid var(--color-border-tertiary,#e5e5e5)",
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        <div id="simple-form-dialog-title" style={{ fontWeight: 700, fontSize: 15, marginBottom: description ? 6 : 10 }}>
          {title}
        </div>
        {description ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12, lineHeight: 1.45 }}>
            {description}
          </div>
        ) : null}
        <form onSubmit={handleSubmit}>
          {fields.map((f) => (
            <div key={f.name} style={{ marginBottom: 10 }}>
              <label style={{ ...ss.lbl, display: "block", marginBottom: 4 }}>{f.label}</label>
              {f.type === "select" ? (
                <select
                  style={{ ...ss.inp, width: "100%", boxSizing: "border-box" }}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                >
                  {(f.options || []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  style={{
                    ...ss.inp,
                    minHeight: f.rows ? f.rows * 22 : 72,
                    resize: "vertical",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder || ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              ) : (
                <input
                  style={{ ...ss.inp, width: "100%", boxSizing: "border-box" }}
                  type={f.type || "text"}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder || ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </form>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnO} onClick={handleSubmit}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
