/**
 * Collapsible PTW configuration studio — tabs for form, rules, and system settings.
 */
export const PERMIT_STUDIO_TABS = [
  { id: "form", label: "Form & defaults", hint: "Fields, company defaults, appearance" },
  { id: "rules", label: "Rules & workflow", hint: "Conditions, conflicts, transitions" },
  { id: "system", label: "System", hint: "Handover, integrations, audit" },
];

export default function PermitStudioShell({
  open,
  onToggle,
  tab,
  onTabChange,
  stats = {},
  children,
}) {
  const chips = [
    { label: "Field overrides", value: stats.fieldOverrides ?? 0 },
    { label: "Rules", value: stats.conditionalRules ?? 0 },
    { label: "Policy overrides", value: stats.policyOverrides ?? 0 },
  ].filter((c) => c.value > 0);

  return (
    <section className="ptw-studio" aria-label="PTW configuration studio">
      <header className="ptw-studio__header">
        <div className="ptw-studio__intro">
          <h2 className="ptw-studio__title">PTW configuration studio</h2>
          <p className="ptw-studio__lead">
            Tune permit forms, workflow gates, and integrations without JSON — for admins and safety leads.
          </p>
          {chips.length > 0 ? (
            <div className="ptw-studio__chips">
              {chips.map((c) => (
                <span key={c.label} className="ptw-studio__chip">
                  {c.label}: <strong>{c.value}</strong>
                </span>
              ))}
            </div>
          ) : (
            <span className="ptw-studio__chip ptw-studio__chip--muted">Using baseline settings</span>
          )}
        </div>
        <button type="button" className="ptw-studio__toggle" onClick={onToggle} aria-expanded={open}>
          {open ? "Hide studio" : "Open studio"}
        </button>
      </header>

      {open ? (
        <>
          <nav className="ptw-studio__tabs" role="tablist" aria-label="Studio sections">
            {PERMIT_STUDIO_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`ptw-studio__tab${tab === t.id ? " ptw-studio__tab--active" : ""}`}
                onClick={() => onTabChange(t.id)}
              >
                <span className="ptw-studio__tab-label">{t.label}</span>
                <span className="ptw-studio__tab-hint">{t.hint}</span>
              </button>
            ))}
          </nav>
          <div className="ptw-studio__body" role="tabpanel">
            {children}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** Section card inside studio panels */
export function PermitStudioPanel({ title, lead, actions, children, className = "" }) {
  return (
    <article className={`ptw-studio-panel${className ? ` ${className}` : ""}`}>
      <div className="ptw-studio-panel__head">
        <div>
          <h3 className="ptw-studio-panel__title">{title}</h3>
          {lead ? <p className="ptw-studio-panel__lead">{lead}</p> : null}
        </div>
        {actions ? <div className="ptw-studio-panel__actions">{actions}</div> : null}
      </div>
      <div className="ptw-studio-panel__body">{children}</div>
    </article>
  );
}

export const PERMIT_FIELD_SECTIONS = ["Scope", "People", "Timing", "Evidence", "Conditions"];
