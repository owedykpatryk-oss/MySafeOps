/**
 * One recommended next step per project — deterministic, no AI.
 */

import { PROJECT_DOC_KEYS, hasBriefingTodayForProject, todayIsoDate } from "./projectDashboard";
import { isSurveyWorkflowEnabled } from "./projectHubIndustry";
import { pickIndustryProjectNextAction } from "./industryPackProfile";
import { loadOrgScoped as load, asStorageArray } from "./orgStorage";
import { missingRequiredPermits } from "../modules/permits/permitProjectDefaults";
import { setWorkspaceNavTarget, openWorkspaceView } from "./workspaceNavContext";

const STALE_SURVEY_DAYS = 14;
const PERMIT_EXPIRY_WARN_DAYS = 7;

function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

function groupByProject(rows = []) {
  const map = {};
  for (const row of asStorageArray(rows)) {
    const pid = row?.projectId;
    if (!pid) continue;
    if (!map[pid]) map[pid] = [];
    map[pid].push(row);
  }
  return map;
}

/** Load all docs once for batch next-action scans. */
export function loadProjectActionContext() {
  const dailyBriefings = load(PROJECT_DOC_KEYS.dailyBriefings, []);
  return buildProjectActionContext({
    rams: load(PROJECT_DOC_KEYS.rams, []),
    surveys: load(PROJECT_DOC_KEYS.surveys, []),
    gprReports: load(PROJECT_DOC_KEYS.gprReports, []),
    permits: load(PROJECT_DOC_KEYS.permits, []),
    methodStatements: load(PROJECT_DOC_KEYS.methodStatements, []),
    dailyBriefings,
    plans: [],
  });
}

export function buildProjectActionContext({
  rams = [],
  surveys = [],
  gprReports = [],
  permits = [],
  methodStatements = [],
  dailyBriefings = [],
  plans = [],
  inspections = [],
  snags = [],
} = {}) {
  return {
    ramsByProject: groupByProject(rams),
    surveysByProject: groupByProject(surveys),
    gprReportsByProject: groupByProject(gprReports),
    permitsByProject: groupByProject(permits),
    methodStatementsByProject: groupByProject(methodStatements),
    dailyBriefingsByProject: groupByProject(dailyBriefings),
    plansByProject: groupByProject(plans),
    inspectionsByProject: groupByProject(inspections),
    snagsByProject: groupByProject(snags),
    allPermits: permits,
    allDailyBriefings: dailyBriefings,
  };
}

/**
 * @returns {{ label: string, viewId: string, action?: string, projectId: string, reportId?: string, permitId?: string, tone?: string } | null}
 */
export function pickNextActionForProject(project, ctx) {
  if (!project?.id || project.closed) return null;
  const pid = project.id;
  const rams = ctx.ramsByProject[pid] || [];
  const surveys = ctx.surveysByProject[pid] || [];
  const gprReports = ctx.gprReportsByProject[pid] || [];
  const permits = ctx.permitsByProject[pid] || [];
  const plans = ctx.plansByProject[pid] || [];
  const methodStatements = ctx.methodStatementsByProject[pid] || [];

  if (!rams.length) {
    return {
      label: "Create RAMS",
      viewId: "rams",
      action: "create",
      projectId: pid,
      tone: "warn",
    };
  }

  const missingPermits = missingRequiredPermits(project, permits);
  if (missingPermits.length) {
    const type = missingPermits[0].replace(/_/g, " ");
    return {
      label: `Issue ${type} PTW`,
      viewId: "permits",
      action: "issueFromDefaults",
      projectId: pid,
      tone: "warn",
    };
  }

  const activeNoRams = permits.filter((p) => p.status === "active" && !String(p.linkedRamsId || "").trim());
  if (activeNoRams.length) {
    return {
      label: "Link RAMS to active PTW",
      viewId: "permits",
      action: "view",
      projectId: pid,
      permitId: activeNoRams[0].id,
      tone: "warn",
    };
  }

  const expiringPermit = permits.find((p) => {
    if (p.status !== "active") return false;
    const d = daysUntil(p.endDateTime || p.expiryDate);
    return d != null && d >= 0 && d <= PERMIT_EXPIRY_WARN_DAYS;
  });
  if (expiringPermit) {
    const d = daysUntil(expiringPermit.endDateTime || expiringPermit.expiryDate);
    return {
      label: `PTW expires in ${d} day${d === 1 ? "" : "s"}`,
      viewId: "permits",
      action: "view",
      projectId: pid,
      permitId: expiringPermit.id,
      tone: "warn",
    };
  }

  const projectBriefings = ctx.dailyBriefingsByProject[pid] || [];
  if (!hasBriefingTodayForProject(ctx.allDailyBriefings?.length ? ctx.allDailyBriefings : projectBriefings, pid, todayIsoDate())) {
    return {
      label: "Record today's briefing",
      viewId: "daily-briefing",
      action: "create",
      projectId: pid,
      tone: "warn",
    };
  }

  const industryAction = pickIndustryProjectNextAction(project, ctx);
  if (industryAction) return industryAction;

  if (!surveys.length && isSurveyWorkflowEnabled()) {
    return {
      label: "Create survey draft",
      viewId: "survey-report",
      action: "createReport",
      projectId: pid,
      tone: "info",
    };
  }

  if (
    isSurveyWorkflowEnabled() &&
    surveys.length &&
    !gprReports.length &&
    (project.playbookId === "utility_mapping" || project.playbookId === "site_investigation")
  ) {
    return {
      label: "Create GPR report draft",
      viewId: "gpr-report",
      projectId: pid,
      tone: "info",
    };
  }

  const staleDraft = isSurveyWorkflowEnabled()
    ? surveys
        .filter((s) => s.status !== "final")
        .sort((a, b) => (daysSince(b.updatedAt || b.createdAt) || 0) - (daysSince(a.updatedAt || a.createdAt) || 0))[0]
    : null;
  if (staleDraft) {
    const age = daysSince(staleDraft.updatedAt || staleDraft.createdAt);
    if (age != null && age >= STALE_SURVEY_DAYS) {
      return {
        label: `Survey draft idle ${age}d`,
        viewId: "survey-report",
        action: "edit",
        projectId: pid,
        reportId: staleDraft.id,
        tone: "info",
      };
    }
  }

  if (!methodStatements.length) {
    return {
      label: "Add method statement",
      viewId: "method-statement",
      action: "create",
      projectId: pid,
      tone: "info",
    };
  }

  if (!plans.length && !(project.boundaryPoints?.length || project.lat)) {
    return {
      label: "Add site location / drawings",
      viewId: "projects",
      action: "editProject",
      projectId: pid,
      tone: "calm",
    };
  }

  const openChecklist = (project.startupChecklist || []).filter((x) => x?.status !== "done").length;
  if (openChecklist > 0) {
    return {
      label: `Startup checklist (${openChecklist} open)`,
      viewId: "projects",
      action: "viewProjectDashboard",
      projectId: pid,
      tone: "calm",
    };
  }

  return null;
}

/** @returns {Array<{ project: object, action: object }>} */
export function listProjectsWithNextActions(projects = [], ctx) {
  return (projects || [])
    .filter((p) => p?.id && !p.closed)
    .map((project) => ({ project, action: pickNextActionForProject(project, ctx) }))
    .filter((row) => row.action);
}

export function openProjectNextAction(action) {
  if (!action?.viewId || !action?.projectId) return;
  const target = {
    viewId: action.viewId,
    projectId: action.projectId,
  };
  if (action.action) target.action = action.action;
  if (action.reportId) target.reportId = action.reportId;
  if (action.permitId) target.permitId = action.permitId;
  if (action.ramsId) target.ramsId = action.ramsId;
  setWorkspaceNavTarget(target);
  openWorkspaceView({ viewId: action.viewId });
}
