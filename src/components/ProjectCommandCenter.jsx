import { memo, useEffect, useMemo, useState } from "react";
import ProjectSitePreviewMap from "./ProjectSitePreviewMap";
import { openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { parseProjectBoundaryRing } from "../utils/projectBoundary";
import { permitReadinessForProject } from "../modules/permits/permitProjectDefaults";

function fmtDay(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildActivityFeed(projectId, { rams = [], permits = [], surveyReports = [] }) {
  const items = [];
  const push = (at, kind, text, viewId, action) => {
    if (!at) return;
    items.push({ at: new Date(at).getTime(), kind, text, viewId, action });
  };
  rams.filter((r) => r.projectId === projectId).forEach((r) => {
    push(r.updatedAt || r.createdAt, "rams", `RAMS: ${r.title || r.documentNo || "Document"}`, "rams", "edit");
  });
  permits.filter((p) => p.projectId === projectId).forEach((p) => {
    push(p.updatedAt || p.createdAt, "permit", `PTW ${p.type || "permit"} — ${p.location || "site"}`, "permits", "view");
  });
  surveyReports.filter((s) => s.projectId === projectId).forEach((s) => {
    push(s.updatedAt || s.createdAt, "survey", `Survey: ${s.title || s.ref || "Report"}`, "survey-report", "edit");
  });
  return items.sort((a, b) => b.at - a.at).slice(0, 6);
}

/**
 * Per-project command center — map, intel, doc counts, quick actions, activity.
 */
const EMPTY_ROUTES = [];

function ProjectCommandCenter({
  projects = [],
  rams = [],
  permits = [],
  surveyReports = [],
  style,
}) {
  const active = useMemo(() => projects.filter((p) => !p.closed), [projects]);
  const [projectId, setProjectId] = useState(() => active[0]?.id || "");

  useEffect(() => {
    if (projectId && active.some((p) => p.id === projectId)) return;
    setProjectId(active[0]?.id || "");
  }, [active, projectId]);

  const project = useMemo(
    () => active.find((p) => p.id === projectId) || active[0] || null,
    [active, projectId]
  );

  const boundaryRing = useMemo(() => (project ? parseProjectBoundaryRing(project) : null), [project]);

  const escapeRoutes = useMemo(
    () => (Array.isArray(project?.mapEscapeRoutes) ? project.mapEscapeRoutes : EMPTY_ROUTES),
    [project?.mapEscapeRoutes]
  );

  const permitReady = useMemo(
    () => (project ? permitReadinessForProject(project, permits) : { required: 0, issued: 0, complete: true }),
    [project, permits]
  );

  const projectRams = useMemo(
    () => (project ? rams.filter((r) => r.projectId === project.id) : []),
    [project, rams]
  );
  const projectPermits = useMemo(
    () => (project ? permits.filter((p) => p.projectId === project.id) : []),
    [project, permits]
  );
  const projectSurveys = useMemo(
    () => (project ? surveyReports.filter((s) => s.projectId === project.id) : []),
    [project, surveyReports]
  );
  const activePermits = projectPermits.filter((p) => p.status === "active").length;

  const healthPct = Math.max(0, Math.min(100, Number(project?.healthScore) || 0));
  const activity = useMemo(
    () => (project ? buildActivityFeed(project.id, { rams, permits, surveyReports }) : []),
    [project, rams, permits, surveyReports]
  );

  const go = (viewId, action) => {
    if (!project?.id) return;
    setWorkspaceNavTarget({ viewId, projectId: project.id, action });
    openWorkspaceView({ viewId });
  };

  if (active.length === 0) {
    return (
      <section className="app-command-center app-command-center--empty" style={style}>
        <div className="app-command-center__head">
          <h2 className="app-command-center__title">Project command center</h2>
          <p className="app-command-center__lead">Create a project to see site map, weather, documents and today&apos;s activity in one place.</p>
        </div>
        <button
          type="button"
          className="app-command-center__cta"
          onClick={() => {
            setWorkspaceNavTarget({ viewId: "workers", action: "createProject" });
            openWorkspaceView({ viewId: "workers" });
          }}
        >
          + Create first project
        </button>
      </section>
    );
  }

  return (
    <section className="app-command-center app-dashboard-rise" style={style} aria-labelledby="command-center-title">
      <div className="app-command-center__head">
        <div>
          <p className="app-command-center__eyebrow">Site control</p>
          <h2 id="command-center-title" className="app-command-center__title">
            {project?.name || "Project command center"}
          </h2>
          <p className="app-command-center__lead">
            {[project?.address, project?.postcode].filter(Boolean).join(", ") || "Add address in Workers for full site intel."}
          </p>
        </div>
        <select
          className="app-command-center__select"
          value={project?.id || ""}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Select project"
        >
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "Untitled"}
            </option>
          ))}
        </select>
      </div>

      <div className="app-command-center__grid">
        <div className="app-command-center__map-col">
          <ProjectSitePreviewMap
            lat={project?.lat}
            lng={project?.lng}
            boundaryRing={boundaryRing}
            escapeRoutes={escapeRoutes}
            height={200}
            label={project?.name || "Site"}
          />
        </div>

        <div className="app-command-center__stats">
          <div className="app-command-center__stat">
            <span className="app-command-center__stat-val">{projectRams.length}</span>
            <span className="app-command-center__stat-lbl">RAMS</span>
          </div>
          <div className="app-command-center__stat">
            <span className="app-command-center__stat-val">{activePermits}</span>
            <span className="app-command-center__stat-lbl">Active PTW</span>
          </div>
          <div className="app-command-center__stat">
            <span className="app-command-center__stat-val">{projectSurveys.length}</span>
            <span className="app-command-center__stat-lbl">Surveys</span>
          </div>
          {permitReady.required > 0 ? (
            <div className="app-command-center__stat">
              <span className="app-command-center__stat-val">
                {permitReady.issued}/{permitReady.required}
              </span>
              <span className="app-command-center__stat-lbl">Permit flow</span>
            </div>
          ) : null}
        </div>

        <div className="app-command-center__intel">
          {project?.weatherSnapshot ? (
            <div className="app-command-center__intel-row">
              <strong>Now:</strong> {project.weatherSnapshot.replace(/^Site weather[^:]*:\s*/i, "").slice(0, 120)}
            </div>
          ) : null}
          {project?.weatherAtStartSnapshot ? (
            <div className="app-command-center__intel-row">
              <strong>Start ({project.weatherAtStartDate || project.timelineStart}):</strong>{" "}
              {project.weatherAtStartSnapshot.replace(/^Forecast for[^:]*:\s*/i, "").slice(0, 120)}
            </div>
          ) : null}
          {project?.nearestHospital ? (
            <div className="app-command-center__intel-row">
              <strong>A&amp;E:</strong> {project.nearestHospital}
            </div>
          ) : null}
          {!project?.weatherSnapshot && !project?.weatherAtStartSnapshot && !project?.nearestHospital ? (
            <div className="app-command-center__intel-row app-command-center__intel-row--muted">
              Run site intel in Workers (weather + hospital + forecast for start date).
            </div>
          ) : null}
        </div>
      </div>

      <div className="app-command-center__progress">
        <div className="app-command-center__progress-labels">
          <span>Project readiness</span>
          <span>{healthPct}%</span>
        </div>
        <div className="app-command-center__progress-track">
          <div className="app-command-center__progress-fill" style={{ width: `${healthPct}%` }} />
        </div>
      </div>

      <div className="app-command-center__actions">
        <button type="button" onClick={() => go("workers", "editProject")}>
          Edit site
        </button>
        <button type="button" onClick={() => go("project-drawings")}>
          Plans
        </button>
        <button type="button" onClick={() => go("rams")}>
          RAMS
        </button>
        <button type="button" onClick={() => go("permits", "issueFromDefaults")}>
          Issue PTW
        </button>
        <button type="button" onClick={() => go("survey-report")}>
          Survey
        </button>
        <button type="button" onClick={() => go("site-map")}>
          Site map
        </button>
      </div>

      {activity.length > 0 ? (
        <div className="app-command-center__activity">
          <div className="app-command-center__activity-title">Recent on this site</div>
          <ul>
            {activity.map((a, i) => (
              <li key={`${a.kind}-${i}`}>
                <button type="button" onClick={() => go(a.viewId, a.action)}>
                  {a.text}
                </button>
                <span className="app-command-center__activity-when">{fmtDay(new Date(a.at).toISOString())}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="app-command-center__activity app-command-center__activity--empty">
          No RAMS, permits or survey activity on this project yet — use the actions above.
        </div>
      )}

      {project?.timelineStart && project.timelineStart >= todayIso() && project.weatherAtStartSnapshot ? (
        <div className="app-command-center__alert">
          Work starts {fmtDay(project.timelineStart)} — check forecast before scheduling GPR or roof work.
        </div>
      ) : null}
    </section>
  );
}

export default memo(ProjectCommandCenter);
