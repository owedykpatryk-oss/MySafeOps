/** Live mini-preview of permit form fields from studio field editor config. */

export default function PermitFormPreview({
  permitTypes = {},
  typeId = "_all",
  fieldCatalog = [],
  fieldConfigById = {},
  formDefaults = {},
}) {
  const typeLabel =
    typeId === "_all"
      ? "All permit types (baseline)"
      : permitTypes[typeId]?.label || typeId;

  const sampleType = typeId === "_all" ? Object.keys(permitTypes)[0] || "general" : typeId;
  const typeDef = permitTypes[sampleType] || { label: "Permit", color: "#0d9488", bg: "#f0fdfa" };

  return (
    <div className="ptw-form-preview">
      <div className="ptw-form-preview__chrome">
        <span className="ptw-form-preview__dot" />
        <span className="ptw-form-preview__dot" />
        <span className="ptw-form-preview__dot" />
        <span className="ptw-form-preview__chrome-title">Form preview</span>
      </div>
      <div className="ptw-form-preview__body">
        <div className="ptw-form-preview__type-pill" style={{ color: typeDef.color, background: typeDef.bg }}>
          {typeDef.label}
        </div>
        <div className="ptw-form-preview__meta">{typeLabel}</div>
        {fieldCatalog.map((field) => {
          const cfg = fieldConfigById[field.id] || field;
          const required = Boolean(cfg.required);
          return (
            <div key={field.id} className="ptw-form-preview__field">
              <label className="ptw-form-preview__label">
                {cfg.label || field.label}
                {required ? <span className="ptw-form-preview__req">Required</span> : null}
              </label>
              {field.type === "textarea" ? (
                <div className="ptw-form-preview__input ptw-form-preview__input--area">
                  {cfg.placeholder || "…"}
                </div>
              ) : field.type === "select" ? (
                <div className="ptw-form-preview__input">Select RAMS document…</div>
              ) : field.type === "date" ? (
                <div className="ptw-form-preview__input">dd/mm/yyyy, --:--</div>
              ) : (
                <div className="ptw-form-preview__input">{cfg.placeholder || "…"}</div>
              )}
              {cfg.helpText ? <div className="ptw-form-preview__help">{cfg.helpText}</div> : null}
            </div>
          );
        })}
        {(formDefaults.defaultIssuedBy || formDefaults.defaultIssuedTo) ? (
          <div className="ptw-form-preview__defaults">
            Defaults applied:{" "}
            {[formDefaults.defaultIssuedBy, formDefaults.defaultIssuedTo].filter(Boolean).join(" · ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
