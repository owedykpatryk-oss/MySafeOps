import { loadOrgScoped as load } from "./orgStorage";
import { plansForProject, listProjectPlans } from "../modules/permits/permitPlanOverlayRegistry";
import { permitReadinessForProject } from "../modules/permits/permitProjectDefaults";

export const PROJECT_DOC_KEYS = {
  rams: "rams_builder_docs",
  permits: "permits_v2",
  surveys: "survey_reports",
  geoPhotos: "geo_photos",
  snags: "snags",
  methodStatements: "method_statements",
  dailyBriefings: "daily_briefings",
  cdmPacks: "cdm_packs",
  timesheets: "mysafeops_timesheets",
  inspections: "inspection_records",
};

function totalTimesheetHours(days = {}) {
  return Object.values(days || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
}

function weekStartMonday(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function summarizeTimesheetsForProject(entries = [], projectId) {
  const rows = filterByProject(projectId, entries);
  const weekKey = weekStartMonday(0).toISOString().slice(0, 10);
  const thisWeek = rows.filter((e) => e.weekKey === weekKey);
  const hoursThisWeek = thisWeek.reduce((s, e) => s + totalTimesheetHours(e.days), 0);
  const workersThisWeek = new Set(thisWeek.map((e) => e.workerId).filter(Boolean)).size;
  return {
    all: rows,
    thisWeek,
    hoursThisWeek,
    workersThisWeek,
    weekKey,
  };
}

export function hasBriefingTodayForProject(briefings = [], projectId, dateIso = todayIsoDate()) {
  return (briefings || []).some(
    (b) => b?.projectId === projectId && String(b.date || "").slice(0, 10) === dateIso
  );
}

function ts(row) {
  const raw = row?.updatedAt || row?.createdAt || row?.timestampUtc || row?.markupUpdatedAt || 0;
  const n = new Date(raw).getTime();
  return Number.isFinite(n) ? n : 0;
}

export function sortByRecent(rows = []) {
  return [...rows].sort((a, b) => ts(b) - ts(a));
}

export function filterByProject(projectId, rows = []) {
  if (!projectId) return [];
  return (rows || []).filter((r) => r?.projectId === projectId);
}

export function workersForProject(projectId, workers = []) {
  if (!projectId) return [];
  return (workers || []).filter(
    (w) => Array.isArray(w?.projectIds) && w.projectIds.includes(projectId)
  );
}

export function buildProjectActivityFeed(projectId, data = {}) {
  const {
    rams = [],
    permits = [],
    surveyReports = [],
    geoPhotos = [],
    snags = [],
    methodStatements = [],
    plans = [],
    dailyBriefings = [],
    cdmPacks = [],
    timesheets = [],
  } = data;
  const items = [];
  const push = (row, kind, text, viewId, action, extra = {}) => {
    const at = ts(row);
    if (!at) return;
    items.push({ at, kind, text, viewId, action, ...extra });
  };

  filterByProject(projectId, rams).forEach((r) => {
    push(r, "rams", `RAMS: ${r.title || r.documentNo || "Document"}`, "rams", "edit", { ramsId: r.id });
  });
  filterByProject(projectId, permits).forEach((p) => {
    push(p, "permit", `PTW ${p.type || "permit"} — ${p.location || "site"}`, "permits", "view", {
      permitId: p.id,
    });
  });
  filterByProject(projectId, surveyReports).forEach((s) => {
    push(s, "survey", `Survey: ${s.title || s.ref || "Report"}`, "survey-report", "edit", { reportId: s.id });
  });
  filterByProject(projectId, geoPhotos).forEach((g) => {
    push(
      g,
      "geo-photo",
      `Geo-photo: ${String(g.notes || g.type || "site photo").slice(0, 48)}`,
      "geo-photos",
      "view",
      { geoPhotoId: g.id }
    );
  });
  filterByProject(projectId, snags).forEach((s) => {
    push(s, "snag", `Snag: ${s.title || s.ref || "Item"}`, "snags", "view", { snagId: s.id });
  });
  filterByProject(projectId, methodStatements).forEach((m) => {
    push(m, "method", `Method: ${m.title || "Statement"}`, "method-statement", "view", {
      methodStatementId: m.id,
    });
  });
  filterByProject(projectId, plans).forEach((p) => {
    push(p, "plan", `Plan: ${p.name || "Drawing"}`, "project-drawings", "view", { planId: p.id });
  });
  filterByProject(projectId, dailyBriefings).forEach((b) => {
    push(
      b,
      "briefing",
      `Briefing: ${b.location || b.date || "Site"}`,
      "daily-briefing",
      "view",
      { briefingId: b.id }
    );
  });
  filterByProject(projectId, cdmPacks).forEach((c) => {
    push(c, "cdm", `CDM: ${c.projectTitle || "Compliance pack"}`, "cdm", "view", { cdmPackId: c.id });
  });
  filterByProject(projectId, timesheets).forEach((e) => {
    const hrs = totalTimesheetHours(e.days);
    push(
      e,
      "timesheet",
      `Timesheet: ${hrs ? `${hrs}h` : "Entry"}${e.task ? ` — ${String(e.task).slice(0, 32)}` : ""}`,
      "timesheets",
      "view",
      { timesheetEntryId: e.id }
    );
  });

  return items.sort((a, b) => b.at - a.at).slice(0, 12);
}

/**
 * Aggregate all org-scoped records linked to a project.
 */
export function collectProjectDashboard(project, workers = []) {
  const projectId = project?.id;
  if (!projectId) {
    return {
      rams: [],
      permits: [],
      surveys: [],
      geoPhotos: [],
      snags: [],
      methodStatements: [],
      plans: [],
      dailyBriefings: [],
      cdmPacks: [],
      timesheets: [],
      inspections: [],
      timesheetSummary: { hoursThisWeek: 0, workersThisWeek: 0, weekKey: "" },
      team: [],
      permitReady: { required: 0, issued: 0, complete: true },
      activity: [],
      totals: {
        documents: 0,
        openSnags: 0,
        activePermits: 0,
        permitsMissingRams: 0,
        briefingToday: false,
      },
    };
  }

  const rams = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.rams, [])));
  const permits = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.permits, [])));
  const surveys = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.surveys, [])));
  const geoPhotos = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.geoPhotos, [])));
  const snags = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.snags, [])));
  const methodStatements = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.methodStatements, [])));
  const dailyBriefings = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.dailyBriefings, [])));
  const cdmPacks = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.cdmPacks, [])));
  const timesheetSummary = summarizeTimesheetsForProject(load(PROJECT_DOC_KEYS.timesheets, []), projectId);
  const timesheets = sortByRecent(timesheetSummary.all);
  const inspections = sortByRecent(filterByProject(projectId, load(PROJECT_DOC_KEYS.inspections, [])));
  const plans = sortByRecent(plansForProject(projectId, listProjectPlans()));
  const team = workersForProject(projectId, workers);
  const permitReady = permitReadinessForProject(project, permits);
  const briefingToday = hasBriefingTodayForProject(dailyBriefings, projectId);

  const activity = buildProjectActivityFeed(projectId, {
    rams,
    permits,
    surveyReports: surveys,
    geoPhotos,
    snags,
    methodStatements,
    plans,
    dailyBriefings,
    cdmPacks,
    timesheets,
  });

  const openSnags = snags.filter((s) => s.status !== "closed" && s.status !== "resolved").length;
  const activePermits = permits.filter((p) => p.status === "active").length;
  const permitsMissingRams = permits.filter(
    (p) => p.status === "active" && !String(p.linkedRamsId || "").trim()
  ).length;
  const documents =
    rams.length +
    permits.length +
    surveys.length +
    geoPhotos.length +
    snags.length +
    methodStatements.length +
    plans.length +
    dailyBriefings.length +
    cdmPacks.length +
    timesheets.length +
    inspections.length;

  return {
    rams,
    permits,
    surveys,
    geoPhotos,
    snags,
    methodStatements,
    plans,
    dailyBriefings,
    cdmPacks,
    timesheets,
    inspections,
    timesheetSummary,
    team,
    permitReady,
    activity,
    totals: { documents, openSnags, activePermits, permitsMissingRams, briefingToday },
  };
}

export function fmtProjectDay(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function fmtProjectWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function healthTone(score) {
  const n = Number(score) || 0;
  if (n >= 80) return "good";
  if (n >= 50) return "warn";
  return "bad";
}
