import { openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { permitReadinessForProject } from "../modules/permits/permitProjectDefaults";

const PIPELINE = [
  { key: "project", icon: "📍", label: "Project", hint: "Site & postcode", viewId: "workers", action: "viewProjectDashboard" },
  { key: "intel", icon: "🌦️", label: "Site intel", hint: "Weather & A&E", viewId: "workers", action: "editProject" },
  { key: "plans", icon: "🗺️", label: "Plans", hint: "KML & markup", viewId: "project-drawings" },
  { key: "rams", icon: "⚠️", label: "RAMS", hint: "Method & hazards", viewId: "rams" },
  { key: "permit", icon: "📋", label: "Permit", hint: "PTW on site", viewId: "permits", action: "issueFromDefaults" },
  { key: "survey", icon: "📐", label: "Survey report", hint: "Client deliverable", viewId: "survey-report" },
];

/**
 * Hero “start here” card — project-first workflow with live counts.
 */
export default function ProjectHubCard({ projects = [], rams = [], permits = [], surveyReports = [], style }) {
  const active = projects.filter((p) => !p.closed);
  const recent = active.slice(0, 3);
  const focusProject = recent[0] || active[0] || null;

  const counts = {
    project: active.length,
    intel: active.filter((p) => p.weatherSnapshot || p.nearestHospital || p.weatherAtStartSnapshot).length,
    plans: active.filter((p) => p.boundaryPoints?.length || p.boundaryGeoJson).length,
    rams: rams.length,
    permit: permits.length,
    survey: surveyReports.length,
  };

  const openProject = (projectId, action = "viewProjectDashboard") => {
    setWorkspaceNavTarget({ viewId: "workers", projectId, action });
    openWorkspaceView({ viewId: "workers" });
  };

  const openPipelineStep = (step) => {
    const pid = focusProject?.id;
    if (step.key === "project" && !pid) {
      setWorkspaceNavTarget({ viewId: "workers", action: "createProject" });
      openWorkspaceView({ viewId: "workers" });
      return;
    }
    if (!pid && step.key !== "project") {
      setWorkspaceNavTarget({ viewId: "workers", action: "createProject" });
      openWorkspaceView({ viewId: "workers" });
      return;
    }
    setWorkspaceNavTarget({
      viewId: step.viewId,
      projectId: pid,
      action: step.action || undefined,
    });
    openWorkspaceView({ viewId: step.viewId });
  };

  const createProject = () => {
    setWorkspaceNavTarget({ viewId: "workers", action: "createProject" });
    openWorkspaceView({ viewId: "workers" });
  };

  const pipelineWithCounts = PIPELINE.map((step) => {
    let hint = `${counts[step.key] || 0} on file`;
    if (step.key === "intel") hint = `${counts.intel}/${active.length || 0} enriched`;
    if (step.key === "project") hint = `${counts.project} active`;
    if (step.key === "plans") hint = `${counts.plans}/${active.length || 0} with boundary`;
    if (step.key === "permit" && focusProject) {
      const r = permitReadinessForProject(focusProject, permits);
      if (r.required > 0) hint = `${r.issued}/${r.required} for ${focusProject.name || "site"}`;
    }
    return { ...step, count: counts[step.key], hint };
  });

  return (
    <section className="app-project-hub app-dashboard-rise" style={style} aria-labelledby="project-hub-title">
      <div className="app-project-hub__glow" aria-hidden />
      <div className="app-project-hub__inner">
        <div className="app-project-hub__main">
          <p className="app-project-hub__eyebrow">Start here</p>
          <h2 id="project-hub-title" className="app-project-hub__title">
            Project hub
          </h2>
          <p className="app-project-hub__lead">
            {active.length === 0
              ? "Create a project first — then KML boundary, plans, RAMS, permits and survey reports attach to that site."
              : `${active.length} active project${active.length === 1 ? "" : "s"}. Pipeline steps open the latest site (${focusProject?.name || "pick one below"}).`}
          </p>

          <div className="app-project-hub__pipeline" role="list" aria-label="Typical workflow">
            {pipelineWithCounts.map((step, i) => (
              <div key={step.key} className="app-project-hub__pipeline-item" role="listitem">
                {i > 0 ? <span className="app-project-hub__pipeline-connector" aria-hidden /> : null}
                <button type="button" className="app-project-hub__step app-project-hub__step--btn" onClick={() => openPipelineStep(step)}>
                  <span className="app-project-hub__step-icon" aria-hidden>
                    {step.icon}
                  </span>
                  <span className="app-project-hub__step-label">{step.label}</span>
                  <span className="app-project-hub__step-hint">{step.hint}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="app-project-hub__aside">
          <button type="button" className="app-project-hub__cta" onClick={createProject}>
            + Create project
          </button>
          <div className="app-project-hub__actions">
            <button type="button" className="app-project-hub__action" onClick={() => openWorkspaceView({ viewId: "workers" })}>
              All projects
            </button>
            <button type="button" className="app-project-hub__action" onClick={() => openWorkspaceView({ viewId: "project-drawings" })}>
              Plans
            </button>
            <button type="button" className="app-project-hub__action" onClick={() => openWorkspaceView({ viewId: "rams" })}>
              RAMS
            </button>
            <button type="button" className="app-project-hub__action" onClick={() => openWorkspaceView({ viewId: "permits" })}>
              Permits
            </button>
            <button type="button" className="app-project-hub__action" onClick={() => openWorkspaceView({ viewId: "survey-report" })}>
              Survey
            </button>
            <button type="button" className="app-project-hub__action" onClick={() => openWorkspaceView({ viewId: "site-map" })}>
              Map
            </button>
          </div>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="app-project-hub__recent">
          <span className="app-project-hub__recent-label">Recent sites</span>
          <div className="app-project-hub__recent-list">
            {recent.map((p) => {
              const enriched = Boolean(p.weatherSnapshot || p.nearestHospital || p.weatherAtStartSnapshot);
              const hasCoords = p.lat != null && p.lng != null && String(p.lat).trim() !== "";
              const hasBoundary = Boolean(p.boundaryPoints?.length || p.boundaryGeoJson);
              const permitReady = permitReadinessForProject(p, permits);
              return (
                <button key={p.id} type="button" className="app-project-hub__site-chip" onClick={() => openProject(p.id)}>
                  <span className="app-project-hub__site-name">{p.name || "Untitled"}</span>
                  <span className="app-project-hub__site-meta">
                    {hasCoords ? "On map" : "No coords"}
                    {hasBoundary ? " · Boundary" : ""}
                    {enriched ? " · Intel" : " · Add weather/A&E"}
                    {permitReady.required > 0
                      ? permitReady.complete
                        ? " · Permits OK"
                        : ` · Permits ${permitReady.issued}/${permitReady.required}`
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
