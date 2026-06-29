import { useMemo } from "react";
import ProjectSitePreviewMap from "./ProjectSitePreviewMap";
import { parseProjectBoundaryRing } from "../utils/projectBoundary";
import { openWorkspaceView, setWorkspaceNavTarget } from "../utils/workspaceNavContext";
import { collectProjectDashboard, fmtProjectDay, fmtProjectWhen, healthTone } from "../utils/projectDashboard";
import { getPlaybook, buildMissingDocChecklist } from "../utils/projectPlaybooks";
import { buildProjectActionContext, pickNextActionForProject } from "../utils/projectNextAction";
import { buildProjectHubPulse, printProjectSitePack } from "../utils/projectHubPulse";
import { getFeaturedPlaybooksForOrg, isSurveyWorkflowEnabled } from "../utils/projectHubIndustry";
import { getIndustryPackLabel } from "../utils/industryPackProfile";
import { isIndustryPackPreviewActive } from "../utils/industryPackPreview";

const EMPTY_ROUTES = [];

function ReadinessRing({ pct, tone, size = 104 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div
      className="app-project-dashboard__ring-wrap"
      aria-hidden={false}
      role="img"
      aria-label={`Site readiness ${pct} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="app-project-dashboard__ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="app-project-dashboard__ring-track"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={`app-project-dashboard__ring-fill app-project-dashboard__ring-fill--${tone}`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="app-project-dashboard__ring-label">
        <span className="app-project-dashboard__ring-val">{pct}%</span>
        <span className="app-project-dashboard__ring-cap">ready</span>
      </div>
    </div>
  );
}

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

  const hubPulse = useMemo(() => (project ? buildProjectHubPulse(project, dash) : null), [project, dash]);

  const nextAction = useMemo(() => {
    if (!project?.id) return null;
    const ctx = buildProjectActionContext({
      rams: dash.rams,
      surveys: dash.surveys,
      permits: dash.permits,
      methodStatements: dash.methodStatements,
      dailyBriefings: dash.dailyBriefings,
      plans: dash.plans,
      inspections: dash.inspections,
      snags: dash.snags,
    });
    return pickNextActionForProject(project, ctx);
  }, [project, dash]);

  const boundaryRing = useMemo(() => (project ? parseProjectBoundaryRing(project) : null), [project]);
  const escapeRoutes = useMemo(
    () => (Array.isArray(project?.mapEscapeRoutes) ? project.mapEscapeRoutes : EMPTY_ROUTES),
    [project?.mapEscapeRoutes]
  );

  const healthPct = hubPulse?.readiness ?? Math.max(0, Math.min(100, Number(project?.healthScore) || 0));
  const tone = hubPulse?.tone ?? healthTone(healthPct);
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
      item.id === itemId ? { ...item, status: item.status === "done" ? "todo" : "done" } : item
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
      create_daily_briefing: () => go("daily-briefing", "create"),
      create_cdm: () => go("cdm", "create"),
      capture_geo_photos: () => go("geo-photos", "capture"),
    };
    const fn = actionMap[item.actionType];
    if (fn) fn();
  };

  const playbookMeta = project?.playbookId ? getPlaybook(project.playbookId) : null;
  const missingDocItems = buildMissingDocChecklist(dash);
  const showApplyPlaybook = missingDocItems.length > 0 && onApplyPlaybook;
  const showSurvey = isSurveyWorkflowEnabled();
  const featuredPlaybooks = useMemo(() => getFeaturedPlaybooksForOrg(3), []);

  const runNextAction = () => {
    if (!nextAction) return;
    go(nextAction.viewId, nextAction.action, {
      reportId: nextAction.reportId,
      permitId: nextAction.permitId,
      ramsId: nextAction.ramsId,
    });
  };

  const runCloneDocuments = () => {
    if (!onCloneDocuments) return;
    const targets = (allProjects || []).filter((p) => p.id !== project?.id && !p.closed);
    if (!targets.length) {
      window.alert("Add another active project to copy documents into.");
      return;
    }
    const hint = targets
      .slice(0, 8)
      .map((p) => `${p.name} (${p.id})`)
      .join("\n");
    const targetId = window.prompt(
      `Copy RAMS, surveys and method statements to which project?\n\n${hint}${targets.length > 8 ? "\n…" : ""}\n\nEnter target project ID:`
    );
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
            <span
              className={`app-project-dashboard__chip app-project-dashboard__chip--profile${
                isIndustryPackPreviewActive() ? " app-project-dashboard__chip--preview" : ""
              }`}
            >
              {getIndustryPackLabel()}
              {isIndustryPackPreviewActive() ? " · preview" : ""}
            </span>
            <span className={`app-project-dashboard__chip app-project-dashboard__chip--${tone}`}>
              Live readiness {healthPct}%
            </span>
            {hubPulse ? (
              <span className="app-project-dashboard__chip">
                Pipeline {hubPulse.pipelineDone}/{hubPulse.pipelineTotal}
              </span>
            ) : null}
            {project.timelineStart || project.timelineEnd ? (
              <span className="app-project-dashboard__chip">
                {project.timelineStart || "—"} → {project.timelineEnd || "—"}
              </span>
            ) : null}
            {project.closed ? <span className="app-project-dashboard__chip">Closed</span> : null}
            {playbookMeta ? <span className="app-project-dashboard__chip">Playbook: {playbookMeta.label}</span> : null}
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
              <span className="app-project-dashboard__chip">Checklist {checklistOpen} open</span>
            ) : null}
          </div>
        </div>
        <div className="app-project-dashboard__header-actions">
          <button
            type="button"
            className="app-project-dashboard__btn app-project-dashboard__btn--accent"
            onClick={() => printProjectSitePack(project, dash, workers)}
          >
            Print site pack
          </button>
          <button type="button" className="app-project-dashboard__btn" onClick={() => go("site-map")}>
            Site map
          </button>
          <button type="button" className="app-project-dashboard__btn" onClick={() => onEdit?.(project)}>
            Edit project
          </button>
          {onCloneDocuments ? (
            <button type="button" className="app-project-dashboard__btn" onClick={runCloneDocuments}>
              Clone docs to project
            </button>
          ) : null}
          <button
            type="button"
            className="app-project-dashboard__btn app-project-dashboard__btn--danger"
            onClick={() => onRemove?.(project.id)}
          >
            Remove
          </button>
          <button
            type="button"
            className="app-project-dashboard__btn app-project-dashboard__btn--ghost"
            onClick={onClose}
          >
            {embedded ? "Back to list" : "Close"}
          </button>
        </div>
      </header>

      <section className="app-project-dashboard__spotlight" aria-label="Site status">
        <div className="app-project-dashboard__spotlight-ring">
          <ReadinessRing pct={healthPct} tone={tone} />
          {hubPulse?.briefing ? (
            <p className="app-project-dashboard__spotlight-brief">
              Today: <strong>{hubPulse.briefing.signed}</strong> signed · {hubPulse.briefing.present} on briefing
            </p>
          ) : (
            <p className="app-project-dashboard__spotlight-brief app-project-dashboard__spotlight-brief--warn">
              No briefing recorded today
            </p>
          )}
        </div>

        <div
          className={`app-project-dashboard__next${nextAction ? ` app-project-dashboard__next--${nextAction.tone || "warn"}` : " app-project-dashboard__next--clear"}`}
        >
          {nextAction ? (
            <>
              <p className="app-project-dashboard__next-eyebrow">Do this now</p>
              <p className="app-project-dashboard__next-label">{nextAction.label}</p>
              <button type="button" className="app-project-dashboard__next-cta" onClick={runNextAction}>
                Go →
              </button>
            </>
          ) : (
            <>
              <p className="app-project-dashboard__next-eyebrow">Site status</p>
              <p className="app-project-dashboard__next-label">
                All key gates clear — keep today&apos;s briefing and PTW live.
              </p>
              <button
                type="button"
                className="app-project-dashboard__next-cta app-project-dashboard__next-cta--ghost"
                onClick={() => go("daily-briefing", "create")}
              >
                Log briefing
              </button>
            </>
          )}
        </div>

        {hubPulse?.pipeline?.length ? (
          <div className="app-project-dashboard__spotlight-pipeline" role="list" aria-label="Site workflow">
            {hubPulse.pipeline.map((step, i) => (
              <div key={step.key} className="app-project-dashboard__spotlight-step-wrap" role="listitem">
                {i > 0 ? <span className="app-project-dashboard__spotlight-connector" aria-hidden /> : null}
                <button
                  type="button"
                  className={`app-project-dashboard__spotlight-step app-project-dashboard__spotlight-step--${step.status}`}
                  onClick={() => go(step.viewId, step.action)}
                  title={step.hint}
                >
                  <span className="app-project-dashboard__spotlight-step-icon" aria-hidden>
                    {step.icon}
                  </span>
                  <span className="app-project-dashboard__spotlight-step-label">{step.label}</span>
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {hubPulse?.pulse?.length ? (
        <div className="app-project-dashboard__pulse" role="list" aria-label="Compliance pulse">
          {hubPulse.pulse.map((item) => (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className={`app-project-dashboard__pulse-card app-project-dashboard__pulse-card--${item.status}`}
              onClick={() => item.viewId && go(item.viewId, item.action)}
            >
              <span className="app-project-dashboard__pulse-dot" aria-hidden />
              <span className="app-project-dashboard__pulse-label">{item.label}</span>
              <span className="app-project-dashboard__pulse-value">{item.value}</span>
            </button>
          ))}
        </div>
      ) : null}

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
          <div className="app-project-dashboard__stat-grid app-project-dashboard__stat-grid--compact">
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
        </div>
      </div>

      <div className="app-project-dashboard__quick">
        <button type="button" onClick={() => go("daily-briefing", "create")}>
          + Briefing
        </button>
        <button type="button" onClick={() => go("rams", "create")}>
          + RAMS
        </button>
        <button type="button" onClick={() => go("permits", "issueFromDefaults")}>
          + Permit
        </button>
        {showSurvey ? (
          <button type="button" onClick={() => go("survey-report", "createReport")}>
            + Survey
          </button>
        ) : (
          <button type="button" onClick={() => go("inspections")}>
            Inspections
          </button>
        )}
        <button type="button" onClick={() => go("cdm", "create")}>
          + CDM
        </button>
        <button type="button" onClick={() => go("timesheets", "create")}>
          + Timesheet
        </button>
        <button type="button" onClick={() => go("geo-photos", "capture")}>
          Geo-photo
        </button>
        <button type="button" onClick={() => go("project-drawings")}>
          Drawings
        </button>
        <button type="button" onClick={() => go("method-statement", "create")}>
          Method statement
        </button>
        <button type="button" onClick={() => go("snags", "create")}>
          Snags
        </button>
      </div>

      {showApplyPlaybook ? (
        <div className="app-project-dashboard__alert">
          <strong>Missing site documents</strong> — apply a playbook to create RAMS, PTW and method statement drafts in
          one step.
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {featuredPlaybooks.map((pb) => (
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

      {!dash.totals.briefingToday ? (
        <div className="app-project-dashboard__alert app-project-dashboard__alert--warn">
          <strong>No daily briefing for today</strong> — record attendance and hazards before work starts.
          <button
            type="button"
            className="app-project-dashboard__alert-action"
            onClick={() => go("daily-briefing", "create")}
          >
            Record briefing
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
                    <button
                      type="button"
                      className="app-project-dashboard__checklist-action"
                      onClick={() => runChecklistAction(item)}
                    >
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
          title="Daily briefings"
          count={dash.dailyBriefings.length}
          emptyHint="No site briefings linked yet — record today's pre-start briefing."
          actionLabel="+ Today's briefing"
          onAction={() => go("daily-briefing", "create")}
        >
          {dash.dailyBriefings.slice(0, 8).map((b) => (
            <DocRow
              key={b.id}
              title={b.location || "Site briefing"}
              meta={[b.date, b.conductedBy, `${(b.attendees || []).filter((a) => a.present).length} present`]
                .filter(Boolean)
                .join(" · ")}
              badge={b.date === new Date().toISOString().slice(0, 10) ? "today" : ""}
              onClick={() => go("daily-briefing", "view", { briefingId: b.id })}
            />
          ))}
        </DocSection>

        <DocSection
          title="CDM compliance"
          count={dash.cdmPacks.length}
          emptyHint="No CDM pack yet — add Construction Phase Plan and dutyholder checklist."
          actionLabel="+ CDM pack"
          onAction={() => go("cdm", "create")}
        >
          {dash.cdmPacks.map((c) => {
            const checked = Object.values(c.dutyholderChecks || {}).filter(Boolean).length;
            return (
              <DocRow
                key={c.id}
                title={c.projectTitle || "CDM pack"}
                meta={[c.clientName, c.startDate ? `Start ${fmtProjectDay(c.startDate)}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
                badge={checked ? `${checked}/10 checks` : c.status || "draft"}
                onClick={() => go("cdm", "view", { cdmPackId: c.id })}
              />
            );
          })}
        </DocSection>

        <DocSection
          title="Timesheets"
          count={dash.timesheets.length}
          emptyHint="No timesheet entries for this project."
          actionLabel="+ Log hours"
          onAction={() => go("timesheets", "create")}
        >
          {dash.timesheets.slice(0, 8).map((e) => {
            const hrs = Object.values(e.days || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
            return (
              <DocRow
                key={e.id}
                title={e.task || "Timesheet entry"}
                meta={[e.weekKey, `${hrs}h`, e.status].filter(Boolean).join(" · ")}
                badge={e.status || "pending"}
                onClick={() => go("timesheets", "view", { timesheetEntryId: e.id })}
              />
            );
          })}
        </DocSection>

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

        {showSurvey ? (
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
        ) : (
          <DocSection
            title="Inspections"
            count={dash.inspections.length}
            emptyHint="No inspections logged for this site yet."
            actionLabel="Open inspections"
            onAction={() => go("inspections")}
          >
            {dash.inspections.slice(0, 8).map((ins) => (
              <DocRow
                key={ins.id}
                title={ins.title || ins.type || "Inspection"}
                meta={[ins.status, fmtProjectWhen(ins.date || ins.createdAt)].filter(Boolean).join(" · ")}
                badge={ins.result || ins.status || ""}
                onClick={() => go("inspections")}
              />
            ))}
          </DocSection>
        )}

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
                      briefingId: a.briefingId,
                      cdmPackId: a.cdmPackId,
                      timesheetEntryId: a.timesheetEntryId,
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
