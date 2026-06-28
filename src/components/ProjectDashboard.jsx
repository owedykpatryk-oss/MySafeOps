import { useMemo } from "react";
import ProjectSitePreviewMap from "./ProjectSitePreviewMap";
import { parseProjectBoundaryRing } from "../utils/projectBoundary";
import { openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import {
  collectProjectDashboard,
  fmtProjectDay,
  fmtProjectWhen,
  healthTone,
} from "../utils/projectDashboard";
import { PROJECT_PLAYBOOKS, getPlaybook, buildMissingDocChecklist } from "../utils/projectPlaybooks";

const EMPTY_ROUTES = [];

function DocSection({ title, count, emptyHint, children, actionLabel, onAction }) {
  return (
    <section className="app-project-dashboard__section">
      <div className="app-project-dashboard__section-head">
        <h3 className="app-project-dashboard__section-title">
          {title}
          <span className="app-project-dashboard__section-count">{count}</span>
        </h3>
        {onAction ? (
          <button type="button" className="app-project-dashboard__section-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="app-project-dashboard__empty">{emptyHint}</p>
      ) : (
        <ul className="app-project-dashboard__doc-list">{children}</ul>
      )}
    </section>
  );
}

function DocRow({ title, meta, badge, onClick }) {
  return (
    <li>
      <button type="button" className="app-project-dashboard__doc-row" onClick={onClick}>
        <span className="app-project-dashboard__doc-main">
          <span className="app-project-dashboard__doc-title">{title}</span>
          {meta ? <span className="app-project-dashboard__doc-meta">{meta}</span> : null}
        </span>
        {badge ? <span className="app-project-dashboard__doc-badge">{badge}</span> : null}
      </button>
    </li>
  );
}

/**
 * Full project dashboard — all linked documents, intel, checklist and quick actions.
 */
export default function ProjectDashboard({
  project,
  workers = [],
  allProjects = [],
  embedded = false,
  onClose,
  onEdit,
  onRemove,
  onUpdateProject,
  onApplyPlaybook,
  onCloneDocuments,
}) {
  const dash = useMemo(() => collectProjectDashboard(project, workers), [project, workers]);

  const boundaryRing = useMemo(
    () => (project ? parseProjectBoundaryRing(project) : null),
    [project]
  );
  const escapeRoutes = useMemo(
    () => (Array.isArray(project?.mapEscapeRoutes) ? project.mapEscapeRoutes : EMPTY_ROUTES),
    [project?.mapEscapeRoutes]
  );

  const healthPct = Math.max(0, Math.min(100, Number(project?.healthScore) || 0));
  const tone = healthTone(healthPct);
  const checklist = Array.isArray(project?.startupChecklist) ? project.startupChecklist : [];
  const checklistOpen = checklist.filter((x) => x?.status !== "done").length;

  const go = (viewId, action, extra = {}) => {
    if (!project?.id) return;
    setWorkspaceNavTarget({ viewId, projectId: project.id, action, ...extra });
    openWorkspaceView({ viewId });
    if (!embedded) onClose?.();
  };

  const toggleChecklistItem = (itemId) => {
    if (!onUpdateProject || !project) return;
    const nextChecklist = checklist.map((item) =>
      item.id === itemId
        ? { ...item, status: item.status === "done" ? "todo" : "done" }
        : item
    );
    const doneCount = nextChecklist.filter((x) => x.status === "done").length;
    const checklistHealth = nextChecklist.length
      ? Math.round((doneCount / nextChecklist.length) * 100)
      : project.healthScore;
    onUpdateProject({
      ...project,
      startupChecklist: nextChecklist,
      healthScore: Math.max(Number(project.healthScore) || 0, checklistHealth),
    });
  };

  const runChecklistAction = (item) => {
    const actionMap = {
      create_rams: () => go("rams", "create"),
      create_survey: () => go("survey-report", "createReport"),
      create_permit: () => go("permits", "issueFromDefaults"),
      create_ms: () => go("method-statement", "create"),
      upload_plan: () => go("project-drawings"),
    };
    const fn = actionMap[item.actionType];
    if (fn) fn();
  };

  const playbookMeta = project?.playbookId ? getPlaybook(project.playbookId) : null;
  const missingDocItems = buildMissingDocChecklist(dash);
  const showApplyPlaybook = missingDocItems.length > 0 && onApplyPlaybook;

  const runCloneDocuments = () => {
    if (!onCloneDocuments) return;
    const targets = (allProjects || []).filter((p) => p.id !== project?.id && !p.closed);
    if (!targets.length) {
      window.alert("Add another active project to copy documents into.");
      return;
    }
    const hint = targets.slice(0, 8).map((p) => `${p.name} (${p.id})`).join("\n");
    const targetId = window.prompt(`Copy RAMS, surveys and method statements to which project?\n\n${hint}${targets.length > 8 ? "\n…" : ""}\n\nEnter target project ID:`);
    if (!targetId?.trim()) return;
    const includeGeoPhotos = window.confirm(
      "Also copy geo-photos linked to this project?\n\nOK = yes · Cancel = documents only"
    );
    onCloneDocuments(project, targetId.trim(), { includeGeoPhotos });
  };

  if (!project) return null;

  const panel = (
      <div className={`app-project-dashboard${embedded ? " app-project-dashboard--embedded" : ""}`}>
        <header className="app-project-dashboard__header">
          <div className="app-project-dashboard__header-main">
            <p className="app-project-dashboard__eyebrow">{embedded ? "Project hub" : "Project dashboard"}</p>
            <h1 id="project-dashboard-title" className="app-project-dashboard__title">
              {project.name || "Untitled project"}
            </h1>
            <p className="app-project-dashboard__lead">
              {[project.site, project.address, project.postcode].filter(Boolean).join(" · ") ||
                "Add site details in project settings."}
            </p>
            <div className="app-project-dashboard__chips">
              <span className={`app-project-dashboard__chip app-project-dashboard__chip--${tone}`}>
                Readiness {healthPct}%
              </span>
              {project.timelineStart || project.timelineEnd ? (
                <span className="app-project-dashboard__chip">
                  {project.timelineStart || "—"} → {project.timelineEnd || "—"}
                </span>
              ) : null}
              {project.closed ? <span className="app-project-dashboard__chip">Closed</span> : null}
              {playbookMeta ? (
                <span className="app-project-dashboard__chip">Playbook: {playbookMeta.label}</span>
              ) : null}
              {dash.permitReady.required > 0 ? (
                <span
                  className={`app-project-dashboard__chip ${
                    dash.permitReady.complete ? "app-project-dashboard__chip--good" : "app-project-dashboard__chip--warn"
                  }`}
                >
                  Permits {dash.permitReady.issued}/{dash.permitReady.required}
                </span>
              ) : null}
              {checklist.length > 0 ? (
                <span className="app-project-dashboard__chip">
                  Checklist {checklistOpen} open
                </span>
              ) : null}
            </div>
          </div>
          <div className="app-project-dashboard__header-actions">
            <button type="button" className="app-project-dashboard__btn" onClick={() => onEdit?.(project)}>
              Edit project
            </button>
            {onCloneDocuments ? (
              <button type="button" className="app-project-dashboard__btn" onClick={runCloneDocuments}>
                Clone docs to project
              </button>
            ) : null}
            <button type="button" className="app-project-dashboard__btn app-project-dashboard__btn--danger" onClick={() => onRemove?.(project.id)}>
              Remove
            </button>
            <button type="button" className="app-project-dashboard__btn app-project-dashboard__btn--ghost" onClick={onClose}>
              {embedded ? "Back to list" : "Close"}
            </button>
          </div>
        </header>

        <div className="app-project-dashboard__hero">
          <div className="app-project-dashboard__map">
            <ProjectSitePreviewMap
              lat={project.lat}
              lng={project.lng}
              boundaryRing={boundaryRing}
              escapeRoutes={escapeRoutes}
              geoPhotos={dash.geoPhotos}
              height={220}
              label={project.name || "Site"}
            />
          </div>
          <div className="app-project-dashboard__intel">
            <div className="app-project-dashboard__stat-grid">
              <div className="app-project-dashboard__stat">
                <span className="app-project-dashboard__stat-val">{dash.rams.length}</span>
                <span className="app-project-dashboard__stat-lbl">RAMS</span>
              </div>
              <div className="app-project-dashboard__stat">
                <span className="app-project-dashboard__stat-val">{dash.totals.activePermits}</span>
                <span className="app-project-dashboard__stat-lbl">Active PTW</span>
              </div>
              <div className="app-project-dashboard__stat">
                <span className="app-project-dashboard__stat-val">{dash.surveys.length}</span>
                <span className="app-project-dashboard__stat-lbl">Surveys</span>
              </div>
              <div className="app-project-dashboard__stat">
                <span className="app-project-dashboard__stat-val">{dash.geoPhotos.length}</span>
                <span className="app-project-dashboard__stat-lbl">Geo-photos</span>
              </div>
              <div className="app-project-dashboard__stat">
                <span className="app-project-dashboard__stat-val">{dash.plans.length}</span>
                <span className="app-project-dashboard__stat-lbl">Drawings</span>
              </div>
              <div className="app-project-dashboard__stat">
                <span className="app-project-dashboard__stat-val">{dash.totals.documents}</span>
                <span className="app-project-dashboard__stat-lbl">All docs</span>
              </div>
            </div>
            {project.weatherSnapshot ? (
              <div className="app-project-dashboard__intel-row">
                <strong>Weather:</strong> {project.weatherSnapshot.replace(/^Site weather[^:]*:\s*/i, "").slice(0, 140)}
              </div>
            ) : null}
            {project.weatherAtStartSnapshot ? (
              <div className="app-project-dashboard__intel-row">
                <strong>Start forecast:</strong>{" "}
                {project.weatherAtStartSnapshot.replace(/^Forecast for[^:]*:\s*/i, "").slice(0, 140)}
              </div>
            ) : null}
            {project.nearestHospital ? (
              <div className="app-project-dashboard__intel-row">
                <strong>A&amp;E:</strong> {project.nearestHospital}
              </div>
            ) : null}
            {!project.weatherSnapshot && !project.weatherAtStartSnapshot && !project.nearestHospital ? (
              <div className="app-project-dashboard__intel-row app-project-dashboard__intel-row--muted">
                Run site intel in project settings (weather, hospital, start-date forecast).
              </div>
            ) : null}
            <div className="app-project-dashboard__progress">
              <div className="app-project-dashboard__progress-labels">
                <span>Project readiness</span>
                <span>{healthPct}%</span>
              </div>
              <div className="app-project-dashboard__progress-track">
                <div
                  className={`app-project-dashboard__progress-fill app-project-dashboard__progress-fill--${tone}`}
                  style={{ width: `${healthPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="app-project-dashboard__quick">
          <button type="button" onClick={() => go("rams", "create")}>+ RAMS</button>
          <button type="button" onClick={() => go("permits", "issueFromDefaults")}>+ Permit</button>
          <button type="button" onClick={() => go("survey-report", "createReport")}>+ Survey</button>
          <button type="button" onClick={() => go("geo-photos", "capture")}>Geo-photo</button>
          <button type="button" onClick={() => go("project-drawings")}>Drawings</button>
          <button type="button" onClick={() => go("method-statement", "create")}>Method statement</button>
          <button type="button" onClick={() => go("snags", "create")}>Snags</button>
        </div>

        {showApplyPlaybook ? (
          <div className="app-project-dashboard__alert">
            <strong>Missing site documents</strong> — apply a playbook to create RAMS, survey, PTW and MS drafts in one step.
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {PROJECT_PLAYBOOKS.slice(0, 3).map((pb) => (
                <button
                  key={pb.id}
                  type="button"
                  className="app-project-dashboard__alert-action"
                  onClick={() => onApplyPlaybook(project, pb.id)}
                >
                  {pb.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {dash.totals.permitsMissingRams > 0 ? (
          <div className="app-project-dashboard__alert app-project-dashboard__alert--warn">
            <strong>{dash.totals.permitsMissingRams} active PTW</strong> without linked RAMS — review before handover.
            <button type="button" className="app-project-dashboard__alert-action" onClick={() => go("permits")}>
              Open permits
            </button>
          </div>
        ) : null}

        {checklist.length > 0 ? (
          <section className="app-project-dashboard__checklist">
            <h3 className="app-project-dashboard__section-title">Startup checklist</h3>
            <ul className="app-project-dashboard__checklist-list">
              {checklist.slice(0, 12).map((item) => (
                <li key={item.id} className={item.status === "done" ? "is-done" : ""}>
                  {item.actionType ? (
                    <div className="app-project-dashboard__checklist-row app-project-dashboard__checklist-row--action">
                      <input
                        type="checkbox"
                        checked={item.status === "done"}
                        onChange={() => toggleChecklistItem(item.id)}
                        disabled={!onUpdateProject}
                      />
                      <button type="button" className="app-project-dashboard__checklist-action" onClick={() => runChecklistAction(item)}>
                        {item.text}
                      </button>
                    </div>
                  ) : (
                    <label className="app-project-dashboard__checklist-row">
                      <input
                        type="checkbox"
                        checked={item.status === "done"}
                        onChange={() => toggleChecklistItem(item.id)}
                        disabled={!onUpdateProject}
                      />
                      <span>{item.text}</span>
                    </label>
                  )}
                </li>
              ))}
            </ul>
            {checklist.length > 12 ? (
              <p className="app-project-dashboard__empty">+ {checklist.length - 12} more in project settings</p>
            ) : null}
          </section>
        ) : null}

        {dash.team.length > 0 ? (
          <section className="app-project-dashboard__team">
            <h3 className="app-project-dashboard__section-title">
              Team
              <span className="app-project-dashboard__section-count">{dash.team.length}</span>
            </h3>
            <div className="app-project-dashboard__team-list">
              {dash.team.map((w) => (
                <span key={w.id} className="app-project-dashboard__team-chip">
                  {w.name || "Worker"}
                  {w.role ? ` · ${w.role}` : ""}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <div className="app-project-dashboard__docs">
          <DocSection
            title="RAMS"
            count={dash.rams.length}
            emptyHint="No RAMS linked yet — create one for this site."
            actionLabel="+ New RAMS"
            onAction={() => go("rams", "create")}
          >
            {dash.rams.map((doc) => (
              <DocRow
                key={doc.id}
                title={doc.title || doc.documentNo || "RAMS document"}
                meta={[doc.documentNo, fmtProjectWhen(doc.updatedAt || doc.createdAt)].filter(Boolean).join(" · ")}
                onClick={() => go("rams", "edit", { ramsId: doc.id })}
              />
            ))}
          </DocSection>

          <DocSection
            title="Permits (PTW)"
            count={dash.permits.length}
            emptyHint="No permits issued for this project."
            actionLabel="+ Issue permit"
            onAction={() => go("permits", "issueFromDefaults")}
          >
            {dash.permits.map((p) => (
              <DocRow
                key={p.id}
                title={`${p.type || "Permit"}${p.location ? ` — ${p.location}` : ""}`}
                meta={fmtProjectWhen(p.updatedAt || p.createdAt)}
                badge={!p.linkedRamsId && p.status === "active" ? "no RAMS" : p.status || "draft"}
                onClick={() => go("permits", "view", { permitId: p.id })}
              />
            ))}
          </DocSection>

          <DocSection
            title="Survey reports"
            count={dash.surveys.length}
            emptyHint="No survey reports yet."
            actionLabel="+ New report"
            onAction={() => go("survey-report", "createReport")}
          >
            {dash.surveys.map((s) => (
              <DocRow
                key={s.id}
                title={s.title || s.ref || "Survey report"}
                meta={[s.ref, fmtProjectWhen(s.updatedAt || s.createdAt)].filter(Boolean).join(" · ")}
                onClick={() => go("survey-report", "edit", { reportId: s.id })}
              />
            ))}
          </DocSection>

          <DocSection
            title="Geo-photos"
            count={dash.geoPhotos.length}
            emptyHint="No geo-tagged photos for this site."
            actionLabel="Capture"
            onAction={() => go("geo-photos", "capture")}
          >
            {dash.geoPhotos.slice(0, 6).map((g) => (
              <DocRow
                key={g.id}
                title={String(g.notes || g.type || "Site photo").slice(0, 64)}
                meta={fmtProjectWhen(g.timestampUtc || g.createdAt)}
                onClick={() => go("geo-photos", "view", { geoPhotoId: g.id })}
              />
            ))}
          </DocSection>

          <DocSection
            title="Plans & drawings"
            count={dash.plans.length}
            emptyHint="Upload KML, PDF or image plans for this project."
            actionLabel="Open plans"
            onAction={() => go("project-drawings")}
          >
            {dash.plans.map((plan) => (
              <DocRow
                key={plan.id}
                title={plan.name || "Plan"}
                meta={[plan.mimeType?.split("/").pop(), fmtProjectWhen(plan.createdAt)].filter(Boolean).join(" · ")}
                badge={plan.status || "current"}
                onClick={() => go("project-drawings", "view", { planId: plan.id })}
              />
            ))}
          </DocSection>

          <DocSection
            title="Snags"
            count={dash.snags.length}
            emptyHint="No snags logged."
            actionLabel="+ Log snag"
            onAction={() => go("snags", "create")}
          >
            {dash.snags.slice(0, 8).map((s) => (
              <DocRow
                key={s.id}
                title={s.title || s.ref || "Snag"}
                meta={[s.priority, fmtProjectWhen(s.createdAt)].filter(Boolean).join(" · ")}
                badge={s.status || "open"}
                onClick={() => go("snags", "view", { snagId: s.id })}
              />
            ))}
          </DocSection>

          <DocSection
            title="Method statements"
            count={dash.methodStatements.length}
            emptyHint="No method statements linked."
            actionLabel="+ New"
            onAction={() => go("method-statement", "create")}
          >
            {dash.methodStatements.map((m) => (
              <DocRow
                key={m.id}
                title={m.title || "Method statement"}
                meta={[m.location, fmtProjectWhen(m.updatedAt || m.createdAt)].filter(Boolean).join(" · ")}
                badge={m.status || ""}
                onClick={() => go("method-statement", "view", { methodStatementId: m.id })}
              />
            ))}
          </DocSection>
        </div>

        {dash.activity.length > 0 ? (
          <section className="app-project-dashboard__activity">
            <h3 className="app-project-dashboard__section-title">Recent activity</h3>
            <ul>
              {dash.activity.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <button
                    type="button"
                    onClick={() =>
                      go(a.viewId, a.action, {
                        ramsId: a.ramsId,
                        permitId: a.permitId,
                        reportId: a.reportId,
                        snagId: a.snagId,
                        methodStatementId: a.methodStatementId,
                        planId: a.planId,
                        geoPhotoId: a.geoPhotoId,
                      })
                    }
                  >
                    {a.text}
                  </button>
                  <span>{fmtProjectDay(new Date(a.at).toISOString())}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
  );

  if (embedded) return panel;

  return (
    <div
      className="app-project-dashboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-dashboard-title"
    >
      {panel}
    </div>
  );
}
