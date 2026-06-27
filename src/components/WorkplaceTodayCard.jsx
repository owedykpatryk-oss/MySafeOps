import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";

const todayLabel = new Date().toLocaleDateString("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * “Today at a glance” — urgent counts + one-tap jumps (any org / site).
 */
export default function WorkplaceTodayCard({
  activePermits = 0,
  permitsNeedAttention = 0,
  openSnags = 0,
  snagsInProgress = 0,
  expiringCerts = 0,
  todaySignIns = 0,
  urgentItems = [],
}) {
  const hasUrgent =
    permitsNeedAttention > 0 || expiringCerts > 0 || openSnags > 0 || (urgentItems && urgentItems.length > 0);

  return (
    <section className={`app-workplace-today${hasUrgent ? " app-workplace-today--alert" : ""}`} aria-labelledby="workplace-today-heading">
      <div className="app-workplace-today__head">
        <div>
          <h2 id="workplace-today-heading" className="app-workplace-today__title">
            Today at a glance
          </h2>
          <p className="app-workplace-today__lead">
            {todayLabel} · What needs attention on site right now.
          </p>
        </div>
        {hasUrgent ? (
          <span className="app-workplace-today__badge" role="status">
            Action needed
          </span>
        ) : (
          <span className="app-workplace-today__badge app-workplace-today__badge--ok" role="status">
            All clear
          </span>
        )}
      </div>

      <div className="app-workplace-today__metrics">
        <button type="button" className="app-workplace-today__metric" onClick={() => openWorkspaceView({ viewId: "permits" })}>
          <span className="app-workplace-today__metric-value">{activePermits}</span>
          <span className="app-workplace-today__metric-label">Active permits</span>
          {permitsNeedAttention > 0 ? (
            <span className="app-workplace-today__metric-hint">{permitsNeedAttention} need review</span>
          ) : null}
        </button>
        <button type="button" className="app-workplace-today__metric" onClick={() => openWorkspaceView({ viewId: "workers" })}>
          <span className="app-workplace-today__metric-value">{expiringCerts}</span>
          <span className="app-workplace-today__metric-label">Certs expiring ≤15d</span>
        </button>
        <button type="button" className="app-workplace-today__metric" onClick={() => openWorkspaceView({ viewId: "snags" })}>
          <span className="app-workplace-today__metric-value">{openSnags}</span>
          <span className="app-workplace-today__metric-label">Open snags</span>
          {snagsInProgress > 0 ? (
            <span className="app-workplace-today__metric-hint">{snagsInProgress} in progress</span>
          ) : null}
        </button>
        <button type="button" className="app-workplace-today__metric" onClick={() => openWorkspaceView({ viewId: "induction" })}>
          <span className="app-workplace-today__metric-value">{todaySignIns}</span>
          <span className="app-workplace-today__metric-label">Sign-ins today</span>
        </button>
      </div>

      {urgentItems?.length > 0 ? (
        <ul className="app-workplace-today__alerts">
          {urgentItems.slice(0, 3).map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`app-workplace-today__alert app-workplace-today__alert--${item.severity || "info"}`}
                onClick={() => item.viewId && openWorkspaceView({ viewId: item.viewId })}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="app-workplace-today__actions">
        <button type="button" className="app-workplace-today__action" onClick={() => openWorkspaceView({ viewId: "site-map" })}>
          Site map
        </button>
        <button type="button" className="app-workplace-today__action" onClick={() => openWorkspaceView({ viewId: "rams" })}>
          RAMS
        </button>
        <button type="button" className="app-workplace-today__action" onClick={() => openWorkspaceView({ viewId: "permits" })}>
          Permits
        </button>
        <button type="button" className="app-workplace-today__action app-workplace-today__action--ghost" onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
          Workspace setup
        </button>
      </div>
    </section>
  );
}
