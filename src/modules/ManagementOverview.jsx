import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BadgePoundSterling,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  GitCompareArrows,
  HardHat,
  LayoutDashboard,
  Layers3,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Navigation,
  Pause,
  Play,
  Plus,
  Presentation,
  Radio,
  Search,
  SkipForward,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Trash2,
  Building2,
  Globe2,
  History,
  Truck,
  Users,
  X,
} from "lucide-react";

import ConfirmDialog from "../components/ConfirmDialog";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { useManagementWorkspaceSync } from "../hooks/useManagementWorkspaceSync";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { supabase } from "../lib/supabase";
import { loadManagementRollup } from "../utils/managementRollup";

// Leaflet is heavy and only needed on the overview tab; keeping it lazy also keeps it
// out of the module render smoke test, which has no layout engine to size a map with.
const LazyFootprintMap = lazy(() => import("../components/ManagementFootprintMap"));

// Overview, planner and teams are what a manager opens the module for. The rest are
// occasional, so they load on demand rather than sitting in the module's first chunk.
const ScenarioTab = lazy(() => import("./managementOverview/ScenarioTab"));
const CalendarTab = lazy(() => import("./managementOverview/CalendarTab"));
const MeetingTab = lazy(() => import("./managementOverview/MeetingTab"));
const GroupTab = lazy(() => import("./managementOverview/GroupTab"));
const ClientsTab = lazy(() => import("./managementOverview/ClientsTab"));
import { liveOrgArrayRows } from "../utils/d1ArrayMerge";
import { buildManagementJobs } from "../utils/managementJobs";
import { loadOrgScoped, ORG_DATA_CHANGED_EVENT } from "../utils/orgStorage";
import { buildManagementIcs, countIcsEvents } from "../utils/managementCalendarIcs";
import { buildCrewByTeam, crewWarnings } from "../utils/managementCrew";
import { groupJobsByClient, summariseClients } from "../utils/managementClients";
import { buildProgrammeCsv } from "../utils/managementProgrammeCsv";
import { publicHolidaysBetween } from "../utils/publicHolidays";
import { pushAudit } from "../utils/auditLog";
import { formatActorLabel, getCachedAuthorshipActor } from "../utils/documentAuthorship";
import { getMarketCurrencySymbol, getRamsShortLabel } from "../utils/marketLabels";
import { getOrgMarketId } from "../utils/orgMarket";
import {
  addDays,
  buildManagementDiary,
  buildMobilisationWatch,
  buildPlannerWeeks,
  clampPlannerShift,
  cleanMoney,
  conflictJobIds,
  dateOnly,
  findScheduleConflicts,
  isoDate,
  JOB_STATUSES,
  jobSchedulePhase,
  jobTone,
  loadManagementState,
  diffJobChanges,
  MAX_ARCHIVED_MEETINGS,
  MAX_HISTORY_ENTRIES,
  MOBILISATION_HORIZON_DAYS,
  monthCapacity,
  plannerDaysFromDelta,
  plannerPosition,
  plannerTodayOffset,
  rangesOverlap,
  readinessForJob,
  saveManagementState,
  shiftJobDates,
  sumJobValue,
} from "../utils/managementOverview";
import {
  agoLabel,
  countdownLabel,
  dateLabel,
  formatDay,
  formatMonth,
  formatMoney,
  formatShortMonth,
  freshnessLabel,
  id,
  plural,
  scheduleLabel,
} from "./managementOverview/format";
import { MetricCard, ReadinessRing } from "./managementOverview/ui";
import "../styles/management-overview.css";

const PROJECTS_KEY = "mysafeops_projects";
const WORKERS_KEY = "mysafeops_workers";
const MAX_TEAMS = 30;
const MAX_OPPORTUNITIES = 100;
const HISTORY_FIELD_LABELS = {
  start: "Start date",
  end: "Finish date",
  teamId: "Assigned team",
  status: "Status",
  value: "Contract value",
};

/** The method-statement row is named after the market: RAMS (UK), SWMS (AU), IOR (PL). */
function readinessFields(ramsLabel) {
  return [
    ["dates", "Dates confirmed"],
    ["team", "Team assigned"],
    ["rams", `${ramsLabel} ready`],
    ["permits", "Permits ready"],
    ["survey", "Survey complete"],
    ["client", "Client confirmed"],
  ];
}
const TABS = [
  { id: "overview", icon: LayoutDashboard, label: "Overview" },
  { id: "planner", icon: CalendarDays, label: "90-day planner" },
  { id: "scenario", icon: GitCompareArrows, label: "Scenario planner" },
  { id: "teams", icon: Users, label: "Teams & capacity" },
  { id: "clients", icon: Building2, label: "Clients" },
  { id: "calendar", icon: CalendarCheck2, label: "Calendar sync" },
  { id: "meeting", icon: Presentation, label: "Meeting mode" },
  { id: "group", icon: Globe2, label: "All countries" },
];
const TAB_IDS = TABS.map((tab) => tab.id);
const TAB_PARAM = "mgo";
const FOCUS_VIEWS = ["overview", "planner", "teams"];
const FOCUS_VIEW_LABELS = { overview: "Command overview", planner: "90-day programme", teams: "Team capacity" };
const EMPTY_FILTERS = { query: "", teamId: "", status: "" };
/** How often the module re-reads the wall clock, so an all-day board never goes stale. */
const CLOCK_INTERVAL_MS = 60_000;

function ManagementRestricted() {
  return (
    <section className="mgo-restricted" aria-labelledby="mgo-restricted-title">
      <span className="mgo-restricted__icon"><LockKeyhole size={24} /></span>
      <div>
        <p className="mgo-eyebrow">Management only</p>
        <h1 id="mgo-restricted-title">This overview is private</h1>
        <p>Only organisation administrators and authorised management users can access planning, capacity and pipeline information.</p>
      </div>
    </section>
  );
}

export default function ManagementOverview() {
  const { role, isPlatformOwner } = useApp();
  const { pushToast } = useToast();
  const canView = role === "admin" || Boolean(isPlatformOwner);
  const [state, setState] = useState(loadManagementState);
  const managementSync = useManagementWorkspaceSync({ enabled: canView, state, setState });
  const [rollup, setRollup] = useState(null);
  const [rollupError, setRollupError] = useState("");
  const [rollupBusy, setRollupBusy] = useState(false);
  const [rollupToken, setRollupToken] = useState(0);
  const [projects, setProjects] = useState(() => liveOrgArrayRows(loadOrgScoped(PROJECTS_KEY, [])));
  const [workers, setWorkers] = useState(() => liveOrgArrayRows(loadOrgScoped(WORKERS_KEY, [])));
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [calendarSetupProvider, setCalendarSetupProvider] = useState("");
  const [meetingStep, setMeetingStep] = useState(0);
  const [newAction, setNewAction] = useState({ text: "", owner: "", due: "" });
  const [exportBusy, setExportBusy] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusAutoPlay, setFocusAutoPlay] = useState(false);
  const [scenarioDraft, setScenarioDraft] = useState({ jobId: "", teamId: "", start: "", end: "" });
  const [opportunityDraft, setOpportunityDraft] = useState({ name: "", client: "", site: "", start: "", end: "", teamId: "", value: "" });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [teamPendingRemoval, setTeamPendingRemoval] = useState(null);
  const [undo, setUndo] = useState(null);
  const [drag, setDrag] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** A drag ends in a click on the row; without this the drawer would open every time. */
  const suppressRowClick = useRef(false);
  const drawerRef = useRef(null);
  const calendarSetupRef = useRef(null);
  const tabRefs = useRef({});

  // The tab lives in the URL so a manager can link to "the planner" and a refresh or the
  // browser back button lands where they were.
  const requestedTab = searchParams.get(TAB_PARAM);
  const tab = TAB_IDS.includes(requestedTab) ? requestedTab : "overview";
  const setTab = useCallback(
    (next) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!next || next === "overview") params.delete(TAB_PARAM);
          else params.set(TAB_PARAM, next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const refresh = (event) => {
      if (!event?.detail?.baseKey || event.detail.baseKey === PROJECTS_KEY) {
        setProjects(liveOrgArrayRows(loadOrgScoped(PROJECTS_KEY, [])));
      }
      if (!event?.detail?.baseKey || event.detail.baseKey === WORKERS_KEY) {
        setWorkers(liveOrgArrayRows(loadOrgScoped(WORKERS_KEY, [])));
      }
    };
    window.addEventListener(ORG_DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ORG_DATA_CHANGED_EVENT, refresh);
  }, []);

  // A management board is often left open all day — on a wall screen in focus mode it may
  // never be reloaded. Without a ticking clock "today", the 90-day window and every
  // "updated x minutes ago" freeze at whatever they were when the tab was opened.
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const timer = window.setInterval(tick, CLOCK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Debounced: the notes textarea and every team field would otherwise serialise and write
  // the whole document to storage on each keystroke.
  useEffect(() => {
    if (!canView) return undefined;
    const timer = window.setTimeout(() => saveManagementState(state), 300);
    return () => window.clearTimeout(timer);
  }, [state, canView]);

  useEffect(() => {
    if (tab !== "group" || !canView) return undefined;
    let cancelled = false;
    setRollupError("");
    setRollupBusy(true);
    loadManagementRollup(supabase)
      .then((result) => {
        if (!cancelled) setRollup(result);
      })
      .catch((error) => {
        if (!cancelled) setRollupError(error?.message || "Could not load the consolidated view.");
      })
      .finally(() => {
        if (!cancelled) setRollupBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, canView, rollupToken]);

  const nextFocusView = useCallback(() => {
    const currentIndex = FOCUS_VIEWS.indexOf(tab);
    setTab(FOCUS_VIEWS[(currentIndex + 1) % FOCUS_VIEWS.length]);
  }, [tab, setTab]);

  // Focus mode is driven from across the room: 1-3 pick a screen, space pauses, arrows step.
  useEffect(() => {
    if (!focusMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        setFocusAutoPlay(false);
        setFocusMode(false);
        return;
      }
      const screen = Number(event.key);
      if (Number.isInteger(screen) && screen >= 1 && screen <= FOCUS_VIEWS.length) {
        event.preventDefault();
        setTab(FOCUS_VIEWS[screen - 1]);
        return;
      }
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setFocusAutoPlay((value) => !value);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextFocusView();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        const index = FOCUS_VIEWS.indexOf(tab);
        setTab(FOCUS_VIEWS[(index - 1 + FOCUS_VIEWS.length) % FOCUS_VIEWS.length]);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focusMode, tab, setTab, nextFocusView]);

  useEffect(() => {
    if (!focusMode || !focusAutoPlay) return undefined;
    const timer = window.setInterval(nextFocusView, 12000);
    return () => window.clearInterval(timer);
  }, [focusMode, focusAutoPlay, nextFocusView]);

  const todayIso = useMemo(() => isoDate(new Date(nowMs)), [nowMs]);
  // Keyed on the ISO string, so everything downstream only recomputes when the day rolls over.
  const today = useMemo(() => dateOnly(todayIso), [todayIso]);
  const weeks = useMemo(() => buildPlannerWeeks(today || new Date(), 13), [today]);
  const teamById = useMemo(() => new Map(state.teams.map((team) => [team.id, team])), [state.teams]);
  const teamName = useCallback((teamId) => teamById.get(teamId)?.name || "Unassigned", [teamById]);

  // Market terminology and currency follow the country workspace this plan belongs to.
  const actorLabel = useMemo(() => formatActorLabel(getCachedAuthorshipActor()), []);
  const marketId = useMemo(() => getOrgMarketId(), []);
  const ramsLabel = useMemo(() => getRamsShortLabel(marketId), [marketId]);
  const readinessRows = useMemo(() => readinessFields(ramsLabel), [ramsLabel]);
  const currencySymbol = useMemo(() => getMarketCurrencySymbol(marketId), [marketId]);
  const money = useCallback((value) => formatMoney(value), []);

  // Narrow slice so typing in the meeting notes does not rebuild the whole programme.
  const jobDoc = useMemo(() => ({ jobs: state.jobs, opportunities: state.opportunities }), [state.jobs, state.opportunities]);
  const jobs = useMemo(() => buildManagementJobs(projects, workers, jobDoc), [projects, workers, jobDoc]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;
  // Managers work through the programme job by job; the drawer steps in start-date order.
  const navigableJobs = useMemo(
    () => [...jobs].sort((a, b) => String(a.start || "9999-12-31").localeCompare(String(b.start || "9999-12-31"))),
    [jobs]
  );
  const selectedIndex = selectedJob ? navigableJobs.findIndex((job) => job.id === selectedJob.id) : -1;
  const selectedJobHistory = useMemo(
    () => (selectedJobId ? state.history.filter((entry) => entry.jobId === selectedJobId) : []),
    [state.history, selectedJobId]
  );
  const stepJob = (delta) => {
    if (selectedIndex < 0) return;
    const next = navigableJobs[selectedIndex + delta];
    if (next) setSelectedJobId(next.id);
  };
  // Bank holidays for the whole planning window, computed from the market rather than stored.
  const holidays = useMemo(
    () => (today ? publicHolidaysBetween(marketId, isoDate(addDays(today, -31)), isoDate(addDays(today, 120))) : []),
    [marketId, today]
  );
  const holidayDates = useMemo(() => holidays.map((entry) => entry.date), [holidays]);
  const diary = useMemo(() => buildManagementDiary(jobs, state.teams, today, holidayDates), [jobs, state.teams, today, holidayDates]);
  const scheduledJobs = diary.scheduled;
  const completedJobs = diary.completed;
  const inProgressJobs = diary.inProgress;
  const overdueJobs = diary.overdue;

  const conflicts = useMemo(() => findScheduleConflicts(jobs, state.teams), [jobs, state.teams]);
  const conflictedIds = useMemo(() => conflictJobIds(conflicts), [conflicts]);

  // Crew rosters are keyed on the day, not the minute: certification alerts move daily.
  const crewByTeam = useMemo(() => buildCrewByTeam(state.teams, workers, today || new Date()), [state.teams, workers, today]);
  const crewIssues = useMemo(() => crewWarnings(crewByTeam, jobs), [crewByTeam, jobs]);
  const mobilisation = useMemo(() => buildMobilisationWatch(jobs, { today, crewByTeam, ramsLabel }), [jobs, today, crewByTeam, ramsLabel]);
  const mobilisationBlocked = useMemo(() => mobilisation.filter((row) => row.issues.length), [mobilisation]);

  const clientRows = useMemo(
    () => (tab === "clients" ? groupJobsByClient(jobs, { today, conflictedIds }) : []),
    [tab, jobs, today, conflictedIds]
  );
  const clientSummary = useMemo(() => summariseClients(clientRows), [clientRows]);
  const pipelineJobs = useMemo(() => jobs.filter((job) => job.source === "opportunity" && job.status !== "cancelled"), [jobs]);
  const values = useMemo(() => ({
    live: sumJobValue(inProgressJobs),
    scheduled: sumJobValue(scheduledJobs),
    pipeline: sumJobValue(pipelineJobs),
    completed: sumJobValue(completedJobs),
  }), [inProgressJobs, scheduledJobs, pipelineJobs, completedJobs]);
  // Money is optional: the strip only appears once someone actually records contract values.
  const tracksValue = values.live + values.scheduled + values.pipeline + values.completed > 0;

  const attentionJobs = useMemo(() => {
    const rank = { overdue: 0, active: 1, upcoming: 2, unscheduled: 3 };
    return jobs
      .filter((job) => job.status !== "completed" && job.status !== "cancelled" && jobTone(job) !== "green")
      .map((job) => ({ ...job, phase: jobSchedulePhase(job, today) }))
      .sort(
        (a, b) =>
          (rank[a.phase] ?? 9) - (rank[b.phase] ?? 9)
          || String(a.start || "9999-12-31").localeCompare(String(b.start || "9999-12-31")),
      );
  }, [jobs, today]);

  const capacityMonths = diary.capacityMonths;
  const capacityRows = useMemo(
    () => state.teams.map((team) => ({ team, values: capacityMonths.map((month) => monthCapacity(jobs, team, month, holidayDates)) })),
    [state.teams, capacityMonths, jobs, holidayDates]
  );
  const overallCapacity = useMemo(() => {
    const values = capacityRows.flatMap((row) => row.values.map((value) => value.percentage));
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  }, [capacityRows]);
  const diaryGaps = diary.gapCount;
  const gapSuggestion = useMemo(() => {
    const choices = capacityRows.flatMap((row) => row.values.map((value, index) => ({ team: row.team, value, month: capacityMonths[index] })));
    return choices.sort((a, b) => a.value.percentage - b.value.percentage)[0] || null;
  }, [capacityRows, capacityMonths]);
  const suggestedOpportunity = state.opportunities.find((job) => !job.teamId) || state.opportunities[0] || null;
  const mapJobs = useMemo(() => [...inProgressJobs, ...scheduledJobs].slice(0, 40), [inProgressJobs, scheduledJobs]);
  const openActions = useMemo(() => state.meeting.actions.filter((action) => action.status !== "Done"), [state.meeting.actions]);
  const overdueActions = useMemo(
    () => openActions.filter((action) => action.due && action.due < todayIso),
    [openActions, todayIso]
  );
  const sortedActions = useMemo(() => {
    const done = (action) => (action.status === "Done" ? 1 : 0);
    return [...state.meeting.actions].sort(
      (a, b) => done(a) - done(b) || String(a.due || "9999-12-31").localeCompare(String(b.due || "9999-12-31")),
    );
  }, [state.meeting.actions]);

  const briefingParts = useMemo(() => [
    inProgressJobs.length
      ? `${inProgressJobs.length} ${plural(inProgressJobs.length, "job is", "jobs are")} on site today.`
      : "No jobs are on site today.",
    `${scheduledJobs.length} ${plural(scheduledJobs.length, "job is", "jobs are")} scheduled in the next 90 days.`,
    overdueJobs.length ? `${overdueJobs.length} ${plural(overdueJobs.length, "job has", "jobs have")} passed the planned finish date without being closed.` : "",
    conflicts.length ? `${conflicts.length} team scheduling ${plural(conflicts.length, "conflict needs", "conflicts need")} resolving.` : "",
    attentionJobs.length ? `${attentionJobs.length} ${plural(attentionJobs.length, "job requires", "jobs require")} management attention.` : "No jobs currently require management intervention.",
    gapSuggestion ? `${gapSuggestion.team.name} has the clearest capacity opportunity in ${formatMonth(gapSuggestion.month)}.` : "Add teams to begin capacity forecasting.",
    openActions.length ? `${openActions.length} management ${plural(openActions.length, "action remains", "actions remain")} open.` : "There are no open management actions.",
  ].filter(Boolean), [inProgressJobs.length, scheduledJobs.length, overdueJobs.length, conflicts.length, attentionJobs.length, gapSuggestion, openActions.length]);

  const scenarioJob = jobs.find((job) => job.id === scenarioDraft.jobId) || null;
  const scenarioTeam = teamById.get(scenarioDraft.teamId) || null;
  const scenarioPreviewJobs = scenarioJob ? jobs.map((job) => job.id === scenarioJob.id ? { ...job, teamId: scenarioDraft.teamId, start: scenarioDraft.start, end: scenarioDraft.end } : job) : jobs;
  const scenarioCapacityBefore = scenarioTeam ? capacityMonths.map((month) => monthCapacity(jobs, scenarioTeam, month, holidayDates)) : [];
  const scenarioCapacityAfter = scenarioTeam ? capacityMonths.map((month) => monthCapacity(scenarioPreviewJobs, scenarioTeam, month, holidayDates)) : [];
  const scenarioConflicts = scenarioJob && scenarioDraft.teamId ? jobs.filter((job) => job.id !== scenarioJob.id && job.teamId === scenarioDraft.teamId && job.status !== "cancelled" && rangesOverlap(scenarioDraft.start, scenarioDraft.end, job.start, job.end)) : [];

  const meetingAgenda = useMemo(() => [
    { label: "Executive briefing", value: `${scheduledJobs.length} jobs in the next 90 days`, detail: `${attentionJobs.length} currently require attention` },
    { label: "Completed work", value: `${completedJobs.length} completed`, detail: "Recorded during the last four weeks" },
    { label: "Upcoming programme", value: `${scheduledJobs.length} scheduled`, detail: `${state.opportunities.length} pipeline opportunities` },
    { label: "Capacity & gaps", value: `${overallCapacity}% average capacity`, detail: `${diaryGaps} low-capacity month slots` },
    { label: "Decisions required", value: `${attentionJobs.length} jobs`, detail: conflicts.length ? `${conflicts.length} scheduling ${plural(conflicts.length, "conflict")} included` : "Readiness, delay or assignment decision" },
    { label: "Actions agreed", value: `${openActions.length} open actions`, detail: overdueActions.length ? `${overdueActions.length} past their due date` : `${state.meeting.actions.length - openActions.length} completed` },
  ], [scheduledJobs.length, attentionJobs.length, completedJobs.length, state.opportunities.length, overallCapacity, diaryGaps, conflicts.length, openActions.length, overdueActions.length, state.meeting.actions.length]);

  const filtersActive = filters.query !== "" || filters.teamId !== "" || filters.status !== "";
  const plannerRows = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    const rows = [];
    for (const job of jobs) {
      const position = plannerPosition(job.start, job.end, weeks);
      if (!position) continue;
      if (filters.status && job.status !== filters.status) continue;
      if (filters.teamId === "unassigned" ? Boolean(job.teamId) : filters.teamId && job.teamId !== filters.teamId) continue;
      if (needle) {
        const haystack = `${job.name} ${job.client} ${job.site}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
      }
      rows.push({ job, position, team: teamById.get(job.teamId) || null });
    }
    return rows.sort((a, b) => String(a.job.start).localeCompare(String(b.job.start)));
  }, [jobs, weeks, filters, teamById]);
  const plannerTotal = useMemo(() => jobs.filter((job) => plannerPosition(job.start, job.end, weeks)).length, [jobs, weeks]);
  const todayOffset = useMemo(() => plannerTodayOffset(weeks, today), [weeks, today]);
  const currentWeekIso = useMemo(() => weeks.find((week) => today >= week.start && today <= week.end)?.iso || "", [weeks, today]);

  const icsPreviewCount = useMemo(() => {
    if (tab !== "calendar") return 0;
    try {
      return countIcsEvents(buildManagementIcs({ jobs, teams: state.teams, calendar: state.calendar, actions: state.meeting.actions, now: new Date(nowMs), ramsLabel }));
    } catch {
      return 0;
    }
  }, [tab, jobs, state.teams, state.calendar, state.meeting.actions, nowMs, ramsLabel]);

  /**
   * Snapshot the document before a destructive change so it can be put back. Everything here
   * writes straight to a shared workspace, and "are you sure?" on every action is worse than
   * one honest way back.
   */
  const rememberUndo = useCallback((label) => setUndo({ label, snapshot: state }), [state]);

  useEffect(() => {
    if (!undo) return undefined;
    const timer = window.setTimeout(() => setUndo(null), 12000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const applyUndo = () => {
    if (!undo) return;
    setState(undo.snapshot);
    setUndo(null);
    pushToast({ type: "info", title: "Change reverted", message: `${undo.label} was put back.` });
  };

  const updateJob = useCallback((jobId, patch) => {
    const job = jobs.find((row) => row.id === jobId);
    // Dates and crew are now a drag away, so the plan has to say who moved what.
    const changes = job ? diffJobChanges(job, patch) : [];
    const stamped = changes.length
      ? changes.map((change) => ({
        id: id("change"),
        jobId,
        jobName: job.name,
        field: change.field,
        from: String(change.from ?? ""),
        to: String(change.to ?? ""),
        at: new Date().toISOString(),
        by: actorLabel,
        byUserId: managementSync.currentUserId || "",
      }))
      : [];

    if (changes.length) {
      const summary = changes.map((change) => change.field).join(", ");
      pushAudit({ area: "management", action: "job-updated", detail: `${job.name}: ${summary}`, entityId: jobId });
    }

    setState((current) => {
      const history = stamped.length ? [...stamped, ...current.history].slice(0, MAX_HISTORY_ENTRIES) : current.history;
      if (current.opportunities.some((row) => row.id === jobId)) {
        return { ...current, history, opportunities: current.opportunities.map((row) => row.id === jobId ? { ...row, ...patch } : row) };
      }
      return { ...current, history, jobs: { ...current.jobs, [jobId]: { ...current.jobs[jobId], ...patch } } };
    });
  }, [jobs, actorLabel, managementSync.currentUserId]);

  const selectScenarioJob = useCallback((jobId) => {
    const job = jobs.find((item) => item.id === jobId);
    setScenarioDraft(job ? { jobId: job.id, teamId: job.teamId || "", start: job.start || "", end: job.end || job.start || "" } : { jobId: "", teamId: "", start: "", end: "" });
  }, [jobs]);

  const applyScenario = () => {
    if (!scenarioJob || !scenarioDraft.start || !scenarioDraft.end || scenarioDraft.end < scenarioDraft.start) return;
    rememberUndo(`Rescheduling ${scenarioJob.name}`);
    updateJob(scenarioJob.id, {
      teamId: scenarioDraft.teamId,
      start: scenarioDraft.start,
      end: scenarioDraft.end,
      readiness: { ...scenarioJob.readiness, dates: true, team: Boolean(scenarioDraft.teamId) },
    });
    setTab("planner");
    pushToast({ type: "success", title: "Scenario applied", message: `${scenarioJob.name} moved to ${dateLabel(scenarioDraft.start)}.` });
  };

  const addTeam = () => {
    if (state.teams.length >= MAX_TEAMS) {
      pushToast({ type: "warning", title: "Team limit reached", message: `A workspace can hold ${MAX_TEAMS} teams.` });
      return;
    }
    const next = state.teams.length + 1;
    setState((current) => ({
      ...current,
      teams: [...current.teams, { id: id("team"), name: `Team ${next}`, colour: "#0f766e", capacity: 5, region: "" }],
    }));
    setTab("teams");
  };

  const updateTeam = (teamId, patch) => {
    setState((current) => ({ ...current, teams: current.teams.map((team) => team.id === teamId ? { ...team, ...patch } : team) }));
  };

  const addTeamDaysOff = (teamId, from, to, label) => {
    if (!from) return;
    setState((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId
        ? { ...team, daysOff: [...(team.daysOff || []), { id: id("off"), from, to: to || from, label: label || "Leave" }] }
        : team),
    }));
  };

  const removeTeamDaysOff = (teamId, offId) => {
    setState((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId
        ? { ...team, daysOff: (team.daysOff || []).filter((row) => row.id !== offId) }
        : team),
    }));
  };

  const toggleTeamMember = (teamId, workerId) => {
    setState((current) => ({
      ...current,
      teams: current.teams.map((team) => {
        if (team.id !== teamId) return team;
        const members = team.memberIds || [];
        return { ...team, memberIds: members.includes(workerId) ? members.filter((id) => id !== workerId) : [...members, workerId] };
      }),
    }));
  };

  const updateCalendar = (patch) => {
    setState((current) => ({ ...current, calendar: { ...current.calendar, ...patch } }));
  };

  const updateMeeting = useCallback((patch) => {
    setState((current) => ({ ...current, meeting: { ...current.meeting, ...patch } }));
  }, []);

  const addMeetingAction = (event) => {
    event.preventDefault();
    if (!newAction.text.trim()) return;
    const action = { id: id("action"), ...newAction, text: newAction.text.trim(), status: "Open" };
    updateMeeting({ actions: [...state.meeting.actions, action] });
    setNewAction({ text: "", owner: "", due: "" });
  };

  const updateMeetingAction = (actionId, patch) => {
    updateMeeting({ actions: state.meeting.actions.map((action) => action.id === actionId ? { ...action, ...patch } : action) });
  };

  const removeMeetingAction = (actionId) => {
    updateMeeting({ actions: state.meeting.actions.filter((action) => action.id !== actionId) });
  };

  /**
   * Close the current meeting into the archive and open a fresh one. Open actions travel with
   * it — previously a new meeting simply overwrote the last set of minutes.
   */
  const archiveMeeting = () => {
    rememberUndo("Archiving the meeting");
    const carried = state.meeting.actions.filter((action) => action.status !== "Done");
    const closed = {
      id: id("meeting"),
      title: state.meeting.title,
      closedOn: todayIso,
      attendees: state.meeting.attendees,
      notes: state.meeting.notes,
      actions: state.meeting.actions,
    };
    setState((current) => ({
      ...current,
      meetings: [closed, ...current.meetings].slice(0, MAX_ARCHIVED_MEETINGS),
      meeting: { ...current.meeting, notes: "", actions: carried },
    }));
    setMeetingStep(0);
    pushToast({
      type: "success",
      title: "Meeting archived",
      message: carried.length ? `${carried.length} open ${plural(carried.length, "action")} carried into the next meeting.` : "Minutes stored in the meeting history.",
    });
  };

  const deleteArchivedMeeting = (meetingId) => {
    rememberUndo("Deleting those minutes");
    setState((current) => ({ ...current, meetings: current.meetings.filter((meeting) => meeting.id !== meetingId) }));
  };

  const downloadFile = useCallback((contents, filename, type) => {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener";
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Safari needs the object URL to outlive the click handler.
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, []);

  /**
   * Reschedule by moving the bar rather than opening a form. The scenario planner still exists
   * for "what if" work; this is for the everyday "it slips a week" that used to need four clicks.
   */
  const moveJobByDays = useCallback((jobId, requestedDays) => {
    const job = jobs.find((row) => row.id === jobId);
    if (!job) return;
    const days = clampPlannerShift(job, requestedDays, weeks);
    const next = shiftJobDates(job, days);
    if (!next) return;
    rememberUndo(`Moving ${job.name}`);
    updateJob(jobId, { start: next.start, end: next.end, readiness: { ...job.readiness, dates: true } });
    pushToast({
      type: "success",
      title: "Job moved",
      message: `${job.name} now runs ${dateLabel(next.start)} – ${dateLabel(next.end)}.`,
    });
  }, [jobs, weeks, rememberUndo, updateJob, pushToast]);

  const onBarPointerDown = (event, job) => {
    if (event.button > 0) return;
    const track = event.currentTarget.closest(".mgo-planner-row__track");
    if (!track) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      jobId: job.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      trackWidth: track.getBoundingClientRect().width,
      days: 0,
      moved: false,
    });
  };

  const onBarPointerMove = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    // A few pixels of wobble while tapping must stay a tap, not a one-day move.
    const moved = drag.moved || Math.abs(deltaX) > 4;
    if (!moved) return;
    const job = jobs.find((row) => row.id === drag.jobId);
    const days = clampPlannerShift(job, plannerDaysFromDelta(deltaX, drag.trackWidth, weeks.length), weeks);
    if (days === drag.days && moved === drag.moved) return;
    setDrag((current) => (current ? { ...current, days, moved } : current));
  };

  const endBarDrag = (event) => {
    if (!drag || (event && drag.pointerId !== event.pointerId)) return;
    const { jobId, days, moved } = drag;
    setDrag(null);
    if (!moved) return;
    suppressRowClick.current = true;
    if (days) moveJobByDays(jobId, days);
  };

  const onRowKeyDown = (event, job) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.shiftKey ? 7 : 1;
    moveJobByDays(job.id, event.key === "ArrowRight" ? step : -step);
  };

  const exportProgrammeCsv = useCallback(() => {
    try {
      const rows = plannerRows.map((row) => row.job);
      const csv = buildProgrammeCsv(rows.length ? rows : jobs, { teams: state.teams, conflictedIds, today });
      // Byte-order mark: without it Excel opens UTF-8 CSV in the local ANSI code page.
      downloadFile(`${String.fromCharCode(0xfeff)}${csv}`, "MySafeOps-programme.csv", "text/csv;charset=utf-8");
      pushToast({ type: "success", title: "Programme exported", message: `${rows.length || jobs.length} ${plural(rows.length || jobs.length, "row")} written to CSV.` });
    } catch (error) {
      pushToast({ type: "error", title: "Export failed", message: error?.message || "Could not build the CSV file." });
    }
  }, [plannerRows, jobs, state.teams, conflictedIds, today, downloadFile, pushToast]);

  const confirmRemoveTeam = () => {
    const teamId = teamPendingRemoval?.id;
    setTeamPendingRemoval(null);
    if (!teamId) return;
    rememberUndo(`Removing ${teamPendingRemoval.name}`);
    setState((current) => ({
      ...current,
      teams: current.teams.filter((team) => team.id !== teamId),
      jobs: Object.fromEntries(Object.entries(current.jobs).map(([jobId, config]) => [jobId, config.teamId === teamId ? { ...config, teamId: "" } : config])),
      opportunities: current.opportunities.map((job) => job.teamId === teamId ? { ...job, teamId: "" } : job),
    }));
  };

  const addOpportunity = (event) => {
    event.preventDefault();
    if (!opportunityDraft.name.trim()) return;
    if (state.opportunities.length >= MAX_OPPORTUNITIES) {
      pushToast({ type: "warning", title: "Pipeline is full", message: `Remove an opportunity before adding another (limit ${MAX_OPPORTUNITIES}).` });
      return;
    }
    const start = opportunityDraft.start || isoDate(addDays(today, 14));
    const end = opportunityDraft.end || isoDate(addDays(dateOnly(start), 4));
    const opportunity = {
      id: id("opportunity"),
      ...opportunityDraft,
      name: opportunityDraft.name.trim(),
      client: opportunityDraft.client.trim() || "Prospective client",
      site: opportunityDraft.site.trim() || "Location to confirm",
      start,
      end: end < start ? start : end,
      value: cleanMoney(opportunityDraft.value),
      status: "provisional",
      readiness: { dates: true, team: Boolean(opportunityDraft.teamId), rams: false, permits: false, survey: false, client: false },
    };
    setState((current) => ({ ...current, opportunities: [...current.opportunities, opportunity] }));
    setOpportunityDraft({ name: "", client: "", site: "", start: "", end: "", teamId: "", value: "" });
    setShowOpportunityForm(false);
    setSelectedJobId(opportunity.id);
  };

  const removeOpportunity = (jobId) => {
    rememberUndo(`Removing ${jobs.find((job) => job.id === jobId)?.name || "the opportunity"}`);
    setState((current) => ({ ...current, opportunities: current.opportunities.filter((job) => job.id !== jobId) }));
    setSelectedJobId(null);
  };

  const exportCalendar = useCallback(() => {
    try {
      const ics = buildManagementIcs({
        jobs,
        teams: state.teams,
        calendar: state.calendar,
        actions: state.meeting.actions,
        now: new Date(),
        ramsLabel,
      });
      const events = countIcsEvents(ics);
      downloadFile(ics, "MySafeOps-management-planner.ics", "text/calendar;charset=utf-8");
      pushToast({ type: "success", title: "Calendar exported", message: `${events} ${plural(events, "event")} written to your calendar file.` });
    } catch (error) {
      pushToast({ type: "error", title: "Export failed", message: error?.message || "Could not build the calendar file." });
    }
  }, [jobs, state.calendar, state.meeting.actions, state.teams, ramsLabel, downloadFile, pushToast]);

  const exportBoardPack = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const { buildManagementBoardPackPdf } = await import("../utils/managementBoardPackPdf");
      const pdfJobs = jobs.map((job) => ({
        ...job,
        teamName: teamName(job.teamId),
        readiness: readinessForJob(job),
        tone: jobTone(job),
      }));
      const conflictNote = conflicts.length ? ` ${conflicts.length} team scheduling ${plural(conflicts.length, "conflict")} detected.` : "";
      await buildManagementBoardPackPdf({
        periodLabel: `${dateLabel(todayIso)} - ${dateLabel(isoDate(diary.inNinetyDays))}`,
        metrics: { scheduled: scheduledJobs.length, attention: attentionJobs.length, capacity: overallCapacity, gaps: diaryGaps },
        briefing: gapSuggestion
          ? `${attentionJobs.length} job(s) require management attention.${conflictNote} ${gapSuggestion.team.name} is ${gapSuggestion.value.percentage}% booked in ${formatMonth(gapSuggestion.month)}. ${suggestedOpportunity ? `${suggestedOpportunity.name} could be reviewed as potential gap-filling work.` : "Review the pipeline for suitable work."}`
          : `No immediate capacity exception has been identified.${conflictNote}`,
        jobs: pdfJobs,
        attentionJobs: pdfJobs.filter((job) => job.status !== "completed" && job.status !== "cancelled" && job.tone !== "green"),
        capacityRows: capacityRows.map((row) => ({ teamName: row.team.name, region: row.team.region, values: row.values })),
        months: capacityMonths.map((month) => formatMonth(month)),
        meeting: state.meeting,
        mobilisation: mobilisation.map((row) => ({
          name: row.job.name,
          days: row.daysToStart,
          teamName: teamName(row.job.teamId),
          outstanding: row.issues.join(", "),
        })),
        conflicts: conflicts.map((conflict) => ({
          teamName: conflict.teamName,
          detail: `${conflict.jobs[0].name} and ${conflict.jobs[1].name} overlap ${dateLabel(conflict.from)} - ${dateLabel(conflict.to)} (${conflict.days} working ${plural(conflict.days, "day")})`,
        })),
        crewWarnings: [
          ...crewIssues.empty.map((team) => `${team.name}: work booked, no crew rostered`),
          ...crewIssues.expired.map((row) => `${row.team.name}: ${row.expired} ${plural(row.expired, "crew member")} with expired certification`),
        ],
        valueSummary: tracksValue
          ? `On site ${money(values.live)} · Next 90 days ${money(values.scheduled)} · Pipeline ${money(values.pipeline)} · Completed in 4 weeks ${money(values.completed)}`
          : "",
      });
      pushToast({ type: "success", title: "Board Pack ready", message: "The PDF has been generated." });
    } catch (error) {
      pushToast({ type: "error", title: "Board Pack failed", message: error?.message || "The PDF could not be generated." });
    } finally {
      setExportBusy(false);
    }
  };

  const onTabKeyDown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = TAB_IDS.indexOf(tab);
    const nextIndex =
      event.key === "Home" ? 0
        : event.key === "End" ? TAB_IDS.length - 1
          : event.key === "ArrowRight" ? (index + 1) % TAB_IDS.length
            : (index - 1 + TAB_IDS.length) % TAB_IDS.length;
    const nextId = TAB_IDS[nextIndex];
    setTab(nextId);
    window.requestAnimationFrame(() => tabRefs.current[nextId]?.focus());
  };

  /** Raw stored values are ids and ISO dates; the log has to read like the fields it describes. */
  const historyValue = useCallback((field, value) => {
    if (!value) return "not set";
    if (field === "start" || field === "end") return dateLabel(value);
    if (field === "teamId") return teamName(value);
    if (field === "value") return money(value);
    return value;
  }, [teamName, money]);

  const closeDrawer = useCallback(() => setSelectedJobId(null), []);
  const closeCalendarSetup = useCallback(() => setCalendarSetupProvider(""), []);
  useModalDismiss({ open: Boolean(selectedJob), onClose: closeDrawer, containerRef: drawerRef });
  useModalDismiss({ open: Boolean(calendarSetupProvider), onClose: closeCalendarSetup, containerRef: calendarSetupRef });

  if (!canView) return <ManagementRestricted />;

  const syncByLine = managementSync.updatedBy
    ? managementSync.updatedBy === managementSync.currentUserId ? " · last edit by you" : " · last edit by a colleague"
    : "";

  return (
    <div className={`mgo ${focusMode ? "mgo--focus" : ""}`}>
      <header className="mgo-hero">
        <div className="mgo-hero__copy">
          <div className="mgo-eyebrow"><LockKeyhole size={12} /> Private management workspace</div>
          <h1>Management overview</h1>
          <p>Your next 90 days, team capacity and H&amp;S readiness in one operational view.</p>
          <div className={`mgo-freshness mgo-freshness--${managementSync.phase}`} role="status">
            <i aria-hidden="true" />
            <span>{managementSync.message}</span>
            {managementSync.updatedAt
              ? <small>{freshnessLabel(managementSync.updatedAt, nowMs)}{syncByLine} · Supabase + live updates</small>
              : <small>Local cache</small>}
          </div>
        </div>
        <div className="mgo-hero__actions">
          <button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setFocusMode((value) => { if (value) setFocusAutoPlay(false); return !value; })}>{focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {focusMode ? "Exit focus" : "Focus mode"}</button>
          <button type="button" className="mgo-btn mgo-btn--ghost" onClick={exportBoardPack} disabled={exportBusy}><Download size={15} /> {exportBusy ? "Building Board Pack..." : "Board Pack PDF"}</button>
          <button type="button" className="mgo-btn mgo-btn--primary" onClick={() => setShowOpportunityForm(true)}><Plus size={15} /> Add opportunity</button>
        </div>
      </header>

      {focusMode ? (
        <section className="mgo-focus-controls" aria-label="Live Management Board controls">
          <div className="mgo-focus-controls__live"><span><Radio size={15} /><i /> Live Management Board</span><small>{FOCUS_VIEW_LABELS[tab] || "Management workspace"}</small></div>
          <div className="mgo-focus-controls__views" aria-label="Presentation screens">{FOCUS_VIEWS.map((view, index) => <button type="button" key={view} className={tab === view ? "is-active" : ""} onClick={() => setTab(view)}><b>{index + 1}</b><span>{FOCUS_VIEW_LABELS[view]}</span></button>)}</div>
          <div className="mgo-focus-controls__actions">
            <button type="button" onClick={() => setFocusAutoPlay((value) => !value)}>{focusAutoPlay ? <Pause size={14} /> : <Play size={14} />}<span>{focusAutoPlay ? "Pause" : "Auto rotate"}</span></button>
            <button type="button" onClick={nextFocusView}><SkipForward size={14} /><span>Next</span></button>
            <button type="button" onClick={() => { setFocusAutoPlay(false); setFocusMode(false); }}><Minimize2 size={14} /><span>Exit</span></button>
          </div>
          <span key={`${tab}-${focusAutoPlay}`} className={`mgo-focus-controls__progress ${focusAutoPlay ? "is-running" : ""}`}><i /></span>
        </section>
      ) : null}

      <nav className="mgo-tabs" role="tablist" aria-label="Management overview sections" onKeyDown={onTabKeyDown}>
        {TABS.map(({ id: value, icon: Icon, label }) => {
          const active = tab === value;
          const badge = value === "planner" && conflicts.length ? conflicts.length : 0;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              id={`mgo-tab-${value}`}
              aria-selected={active}
              aria-controls={`mgo-panel-${value}`}
              tabIndex={active ? 0 : -1}
              ref={(node) => { tabRefs.current[value] = node; }}
              className={active ? "is-active" : ""}
              onClick={() => { setTab(value); if (value === "scenario" && !scenarioDraft.jobId && jobs.length) selectScenarioJob(scheduledJobs[0]?.id || jobs[0].id); }}
            >
              <Icon size={15} />{label}
              {badge ? <em className="mgo-tabs__badge" aria-label={`${badge} scheduling ${plural(badge, "conflict")}`}>{badge}</em> : null}
            </button>
          );
        })}
      </nav>

      {showOpportunityForm ? (
        <form className="mgo-opportunity-form" onSubmit={addOpportunity}>
          <div><span className="mgo-eyebrow">Pipeline</span><h2>Add potential work</h2><p>Potential work appears as a ghost job until it is confirmed.</p></div>
          <label>Job name<input autoFocus value={opportunityDraft.name} onChange={(e) => setOpportunityDraft((d) => ({ ...d, name: e.target.value }))} maxLength={120} required /></label>
          <label>Client<input value={opportunityDraft.client} onChange={(e) => setOpportunityDraft((d) => ({ ...d, client: e.target.value }))} maxLength={120} /></label>
          <label>Location<input value={opportunityDraft.site} onChange={(e) => setOpportunityDraft((d) => ({ ...d, site: e.target.value }))} maxLength={160} /></label>
          <label>Start<input type="date" value={opportunityDraft.start} onChange={(e) => setOpportunityDraft((d) => ({ ...d, start: e.target.value }))} /></label>
          <label>Finish<input type="date" min={opportunityDraft.start} value={opportunityDraft.end} onChange={(e) => setOpportunityDraft((d) => ({ ...d, end: e.target.value }))} /></label>
          <label>Preferred team<select value={opportunityDraft.teamId} onChange={(e) => setOpportunityDraft((d) => ({ ...d, teamId: e.target.value }))}><option value="">Unassigned</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label>Value ({currencySymbol})<input type="number" min="0" step="100" inputMode="decimal" value={opportunityDraft.value} placeholder="0" onChange={(e) => setOpportunityDraft((d) => ({ ...d, value: e.target.value }))} /></label>
          <div className="mgo-opportunity-form__actions"><button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setShowOpportunityForm(false)}>Cancel</button><button className="mgo-btn mgo-btn--primary">Add to planner</button></div>
        </form>
      ) : null}

      <div className="mgo-tabpanel" role="tabpanel" id={`mgo-panel-${tab}`} aria-labelledby={`mgo-tab-${tab}`} tabIndex={-1}>
      {tab === "overview" ? (
        <>
          <section className="mgo-metrics mgo-metrics--six" aria-label="Management summary">
            <MetricCard icon={Timer} value={inProgressJobs.length} label="jobs on site today" tone="blue" detail={overdueJobs.length ? `${overdueJobs.length} past planned finish` : "Started and not yet closed"} onClick={() => setTab("planner")} />
            <MetricCard icon={BriefcaseBusiness} value={scheduledJobs.length} label="jobs in next 90 days" detail={`${state.opportunities.length} pipeline opportunities`} onClick={() => setTab("planner")} />
            <MetricCard icon={CheckCircle2} value={completedJobs.length} label="completed in 4 weeks" tone="green" detail="Based on completed status" />
            <MetricCard icon={AlertTriangle} value={attentionJobs.length} label="jobs need attention" tone={attentionJobs.length ? "red" : "green"} detail="Missing readiness, overdue or delayed" />
            <MetricCard icon={ShieldAlert} value={conflicts.length} label="team conflicts" tone={conflicts.length ? "red" : "green"} detail="Same team, overlapping dates" onClick={conflicts.length ? () => setTab("planner") : undefined} />
            <MetricCard icon={Users} value={`${overallCapacity}%`} label="average capacity" tone={overallCapacity > 100 ? "red" : "purple"} detail={`${diaryGaps} low-capacity ${plural(diaryGaps, "slot")} in 3 months`} onClick={() => setTab("teams")} />
          </section>

          {tracksValue ? (
            <section className="mgo-value-strip" aria-label="Contract value">
              <span className="mgo-value-strip__icon"><BadgePoundSterling size={17} /></span>
              <div><small>On site now</small><strong>{money(values.live)}</strong></div>
              <div><small>Next 90 days</small><strong>{money(values.scheduled)}</strong></div>
              <div><small>Pipeline</small><strong>{money(values.pipeline)}</strong></div>
              <div><small>Completed · 4 weeks</small><strong>{money(values.completed)}</strong></div>
              <p>Contract values are recorded per job in the job drawer.</p>
            </section>
          ) : null}

          <section className="mgo-briefing" aria-labelledby="mgo-briefing-title">
            <div className="mgo-briefing__signal"><Sparkles size={19} /><i /></div>
            <div className="mgo-briefing__copy">
              <span className="mgo-eyebrow">Live management briefing</span>
              <h2 id="mgo-briefing-title">Good {new Date(nowMs).getHours() < 12 ? "morning" : new Date(nowMs).getHours() < 18 ? "afternoon" : "evening"}.</h2>
              <p>{briefingParts.join(" ")}</p>
            </div>
            <div className="mgo-briefing__date"><strong>{formatDay(today)}</strong><span>Live operational view</span></div>
          </section>

          {conflicts.length ? (
            <section className="mgo-conflicts" aria-labelledby="mgo-conflicts-title">
              <div className="mgo-conflicts__head">
                <span className="mgo-conflicts__icon"><ShieldAlert size={18} /></span>
                <div>
                  <span className="mgo-eyebrow">Double booking</span>
                  <h2 id="mgo-conflicts-title">{conflicts.length} team scheduling {plural(conflicts.length, "conflict")}</h2>
                  <p>The same team is committed to overlapping work. Resolve in the planner or move a job in the scenario sandbox.</p>
                </div>
                <button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setTab("scenario")}>Open scenario planner <ArrowRight size={13} /></button>
              </div>
              <ul className="mgo-conflicts__list">
                {conflicts.slice(0, 5).map((conflict) => (
                  <li key={conflict.id}>
                    <strong>{conflict.teamName}</strong>
                    <span>
                      <button type="button" onClick={() => setSelectedJobId(conflict.jobs[0].id)}>{conflict.jobs[0].name}</button>
                      {" vs "}
                      <button type="button" onClick={() => setSelectedJobId(conflict.jobs[1].id)}>{conflict.jobs[1].name}</button>
                    </span>
                    <small>{dateLabel(conflict.from)} – {dateLabel(conflict.to)} · {conflict.days} overlapping working {plural(conflict.days, "day")}</small>
                  </li>
                ))}
              </ul>
              {conflicts.length > 5 ? <p className="mgo-more">+{conflicts.length - 5} more {plural(conflicts.length - 5, "conflict")}</p> : null}
            </section>
          ) : null}

          {mobilisation.length ? (
            <section className="mgo-panel mgo-mobilisation" aria-labelledby="mgo-mobilisation-title">
              <div className="mgo-panel__head">
                <div>
                  <span className="mgo-eyebrow"><Truck size={12} /> Mobilisation watch</span>
                  <h2 id="mgo-mobilisation-title">Leaving the yard in the next {MOBILISATION_HORIZON_DAYS} days</h2>
                  <p>{mobilisationBlocked.length ? `${mobilisationBlocked.length} of ${mobilisation.length} ${plural(mobilisation.length, "job")} still ${plural(mobilisationBlocked.length, "has", "have")} something outstanding.` : "Everything mobilising is documented and crewed."}</p>
                </div>
                <button type="button" onClick={() => setTab("planner")}>Open planner <ChevronRight size={14} /></button>
              </div>
              <ul className="mgo-mobilisation__list">
                {mobilisation.slice(0, 6).map((row) => (
                  <li key={row.job.id} className={`is-${row.severity}`}>
                    <span className="mgo-mobilisation__countdown"><strong>{countdownLabel(row.daysToStart)}</strong><small>{dateLabel(row.job.start)}</small></span>
                    <button type="button" onClick={() => setSelectedJobId(row.job.id)}>
                      <strong>{row.job.name}</strong>
                      <small>{teamName(row.job.teamId)} · {row.job.site}</small>
                    </button>
                    <span className="mgo-mobilisation__issues">
                      {row.issues.length
                        ? row.issues.map((issue) => <em key={issue} className={`mgo-chip ${issue === "Crew" ? "mgo-chip--amber" : "mgo-chip--red"}`}>{issue}</em>)
                        : <em className="mgo-chip mgo-chip--green">Ready</em>}
                    </span>
                  </li>
                ))}
              </ul>
              {mobilisation.length > 6 ? <p className="mgo-more">+{mobilisation.length - 6} more mobilising in this window</p> : null}
            </section>
          ) : null}

          <section className="mgo-smart-card">
            <div className="mgo-smart-card__icon"><Sparkles size={20} /></div>
            <div className="mgo-smart-card__copy">
              <span>Smart gap finder</span>
              {gapSuggestion ? <h2>{gapSuggestion.team.name} is only {gapSuggestion.value.percentage}% booked in {formatMonth(gapSuggestion.month)}.</h2> : <h2>Add your first team to start capacity planning.</h2>}
              <p>{suggestedOpportunity ? `${suggestedOpportunity.name} could be reviewed as potential gap-filling work.` : "Add potential work to the pipeline and MySafeOps will surface the best diary fit."}</p>
            </div>
            {suggestedOpportunity ? <button type="button" className="mgo-btn mgo-btn--smart" onClick={() => setSelectedJobId(suggestedOpportunity.id)}>Review opportunity <ArrowRight size={14} /></button> : <button type="button" className="mgo-btn mgo-btn--smart" onClick={() => setShowOpportunityForm(true)}>Add opportunity <Plus size={14} /></button>}
          </section>

          <section className="mgo-diary" aria-labelledby="mgo-diary-title">
            <div className="mgo-diary__head">
              <div>
                <span className="mgo-eyebrow">Working diary</span>
                <h2 id="mgo-diary-title">On site now · next 3 months · last 4 weeks · capacity gaps</h2>
                <p>What is running today, what is booked ahead, what finished recently, and where teams still have diary space.</p>
              </div>
              <button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setTab("planner")}>Open 90-day planner <ChevronRight size={14} /></button>
            </div>
            <div className="mgo-diary__cols">
              <div className="mgo-diary__col mgo-diary__col--live">
                <header><Timer size={15} /><strong>On site now ({inProgressJobs.length})</strong><small>Started, not closed</small></header>
                <ul>
                  {inProgressJobs.slice(0, 6).map((job) => (
                    <li key={job.id}>
                      <button type="button" onClick={() => setSelectedJobId(job.id)}>
                        <strong>{job.name}</strong>
                        <small>Until {dateLabel(job.end)} · {teamName(job.teamId)}</small>
                      </button>
                    </li>
                  ))}
                  {overdueJobs.slice(0, 3).map((job) => (
                    <li key={`overdue-${job.id}`}>
                      <button type="button" onClick={() => setSelectedJobId(job.id)}>
                        <strong>{job.name}</strong>
                        <small className="is-overdue">Overdue since {dateLabel(job.end)}</small>
                      </button>
                    </li>
                  ))}
                  {!inProgressJobs.length && !overdueJobs.length ? <li className="mgo-diary__empty">Nothing is on site today.</li> : null}
                </ul>
                {inProgressJobs.length > 6 ? <p className="mgo-more">+{inProgressJobs.length - 6} more running</p> : null}
              </div>
              <div className="mgo-diary__col">
                <header><CalendarDays size={15} /><strong>Upcoming ({scheduledJobs.length})</strong><small>Next 90 days</small></header>
                <ul>
                  {scheduledJobs.slice(0, 6).map((job) => (
                    <li key={job.id}>
                      <button type="button" onClick={() => setSelectedJobId(job.id)}>
                        <strong>{job.name}</strong>
                        <small>{dateLabel(job.start)} · {teamName(job.teamId)}</small>
                      </button>
                    </li>
                  ))}
                  {!scheduledJobs.length ? <li className="mgo-diary__empty">No jobs scheduled in the next 90 days.</li> : null}
                </ul>
                {scheduledJobs.length > 6 ? <p className="mgo-more">+{scheduledJobs.length - 6} more scheduled</p> : null}
              </div>
              <div className="mgo-diary__col">
                <header><CheckCircle2 size={15} /><strong>Completed ({completedJobs.length})</strong><small>Last 4 weeks</small></header>
                <ul>
                  {completedJobs.slice(0, 6).map((job) => (
                    <li key={job.id}>
                      <button type="button" onClick={() => setSelectedJobId(job.id)}>
                        <strong>{job.name}</strong>
                        <small>Finished {dateLabel(job.end)} · {job.client || "Client TBC"}</small>
                      </button>
                    </li>
                  ))}
                  {!completedJobs.length ? <li className="mgo-diary__empty">No completed jobs in the last four weeks.</li> : null}
                </ul>
                {completedJobs.length > 6 ? <p className="mgo-more">+{completedJobs.length - 6} more completed</p> : null}
              </div>
              <div className="mgo-diary__col">
                <header><Clock3 size={15} /><strong>Gaps ({diaryGaps})</strong><small>Below 60% booked</small></header>
                <ul>
                  {diary.gaps.slice(0, 6).map((gap) => (
                    <li key={`${gap.teamId}-${gap.monthKey}`}>
                      <button type="button" onClick={() => setTab("teams")}>
                        <strong>{gap.teamName}</strong>
                        <small>{formatMonth(gap.month)} · {gap.percentage}% booked</small>
                      </button>
                    </li>
                  ))}
                  {!diary.gaps.length ? <li className="mgo-diary__empty">No low-capacity months in the next quarter.</li> : null}
                </ul>
                {diary.gaps.length > 6 ? <p className="mgo-more">+{diary.gaps.length - 6} more gaps</p> : null}
              </div>
            </div>
          </section>

          <div className="mgo-overview-grid">
            <section className="mgo-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Priority queue</span><h2>Requires attention</h2><p>Overdue first, then by start date.</p></div><button type="button" onClick={() => setTab("planner")}>Open planner <ChevronRight size={14} /></button></div>
              <div className="mgo-attention-list">
                {attentionJobs.slice(0, 6).map((job) => {
                  const readiness = readinessForJob(job);
                  return (
                    <button type="button" key={job.id} className={`mgo-attention-row ${job.phase === "overdue" ? "is-overdue" : ""}`} onClick={() => setSelectedJobId(job.id)}>
                      <ReadinessRing value={readiness} size="small" />
                      <span className="mgo-attention-row__copy">
                        <strong>{job.name}{conflictedIds.has(job.id) ? <em className="mgo-chip mgo-chip--red">Conflict</em> : null}</strong>
                        <small>{job.teamId ? teamName(job.teamId) : "No team assigned"} · {scheduleLabel(job, today)}</small>
                      </span>
                      <span className={`mgo-status mgo-status--${jobTone(job)}`}>{job.status}</span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
                {!attentionJobs.length ? <div className="mgo-empty"><CheckCircle2 size={24} /><strong>Nothing urgent</strong><span>All scheduled jobs are ready to proceed.</span></div> : null}
              </div>
              {attentionJobs.length > 6 ? <p className="mgo-more">+{attentionJobs.length - 6} more {plural(attentionJobs.length - 6, "job")} need attention</p> : null}
            </section>

            <section className="mgo-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Live forecast</span><h2>Team capacity</h2></div><button type="button" onClick={() => setTab("teams")}>Edit teams <Edit3 size={13} /></button></div>
              <div className="mgo-capacity-mini">
                <div className="mgo-capacity-mini__header"><span>Team</span>{capacityMonths.map((month) => <span key={month.toISOString()}>{formatShortMonth(month)}</span>)}</div>
                {capacityRows.map(({ team, values }) => <div key={team.id} className="mgo-capacity-mini__row"><strong><i style={{ background: team.colour }} />{team.name}</strong>{values.map((value, index) => <span key={index} className={value.percentage > 100 ? "is-over" : value.percentage < 60 ? "is-gap" : "is-healthy"}><b>{value.percentage}%</b><em><i style={{ width: `${Math.min(100, value.percentage)}%` }} /></em></span>)}</div>)}
                {!capacityRows.length ? <div className="mgo-empty"><Users size={24} /><strong>No teams yet</strong><span>Add a team to forecast capacity.</span></div> : null}
              </div>
            </section>
          </div>

          <div className="mgo-command-grid">
            <section className="mgo-panel mgo-risk-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Readiness control</span><h2>Risk &amp; readiness heatmap</h2><p>Select any status to open the job record.</p></div><span className="mgo-live-preview"><i /> Live</span></div>
              <div className="mgo-heatmap">
                <div className="mgo-heatmap__head"><span>Project</span>{readinessRows.map(([key, label]) => <span key={key}>{label.replace(" ready", "").replace(" complete", "")}</span>)}</div>
                {scheduledJobs.slice(0, 8).map((job) => <button type="button" className="mgo-heatmap__row" key={job.id} onClick={() => setSelectedJobId(job.id)}><span><strong>{job.name}</strong><small>{dateLabel(job.start)}</small></span>{readinessRows.map(([key, label]) => <i key={key} className={job.readiness[key] ? "is-ready" : "is-missing"} title={`${label}: ${job.readiness[key] ? "ready" : "requires attention"}`}>{job.readiness[key] ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}</i>)}</button>)}
                {!scheduledJobs.length ? <div className="mgo-empty"><ShieldCheck size={25} /><strong>No scheduled work to assess</strong><span>Add project dates to populate the readiness heatmap.</span></div> : null}
              </div>
              {scheduledJobs.length > 8 ? <p className="mgo-more">Showing the next 8 of {scheduledJobs.length} scheduled jobs</p> : null}
            </section>

            <section className="mgo-panel mgo-map-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Operational footprint</span><h2>UK site activity</h2><p>Regional view based on the project location held in MySafeOps.</p></div><Navigation size={17} /></div>
              <Suspense fallback={<div className="mgo-footprint__loading">Loading map…</div>}>
                <LazyFootprintMap jobs={mapJobs} teams={state.teams} onSelectJob={setSelectedJobId} />
              </Suspense>
              <div className="mgo-map-legend"><span>Pins are coloured by the team assigned to each job. Click a pin to open the job.</span></div>
            </section>
          </div>
        </>
      ) : null}

      {tab === "planner" ? (
        <section className="mgo-panel mgo-planner-panel">
          <div className="mgo-panel__head mgo-panel__head--planner"><div><span className="mgo-eyebrow">Rolling programme</span><h2>Next 13 weeks</h2><p>Green is confirmed and ready. Amber needs information. Red is blocked. Dashed jobs are pipeline opportunities.</p></div><div className="mgo-panel__head-actions"><button type="button" className="mgo-btn mgo-btn--ghost" onClick={exportProgrammeCsv}><FileSpreadsheet size={14} /> Export CSV</button><button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setShowOpportunityForm(true)}><Plus size={14} /> Potential work</button></div></div>

          <div className="mgo-filters" role="group" aria-label="Filter the programme">
            <label className="mgo-filters__search">
              <Search size={14} aria-hidden="true" />
              <input type="search" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search job, client or location" aria-label="Search the programme" maxLength={80} />
            </label>
            <label className="mgo-filters__field">
              <span>Team</span>
              <select value={filters.teamId} onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value }))}>
                <option value="">All teams</option>
                <option value="unassigned">Unassigned</option>
                {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="mgo-filters__field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="">All statuses</option>
                {JOB_STATUSES.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
              </select>
            </label>
            <button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!filtersActive}><Filter size={13} /> Reset</button>
            <span className="mgo-filters__count" role="status">Showing {plannerRows.length} of {plannerTotal} in window</span>
          </div>

          <div className="mgo-planner" style={{ "--weeks": weeks.length }}>
            <div className="mgo-planner__head"><span>Job / team</span><div>{weeks.map((week) => <span key={week.iso} className={week.iso === currentWeekIso ? "is-current" : ""}><b>{formatDay(week.start)}</b><small>{formatShortMonth(week.start)}</small></span>)}</div></div>
            <div className="mgo-planner__rows">
              {plannerRows.map(({ job, position, team }) => {
                const dragging = drag?.jobId === job.id && drag.moved;
                const shift = dragging ? (drag.days / (weeks.length * 7)) * 100 : 0;
                const preview = dragging && drag.days ? shiftJobDates(job, drag.days) : null;
                return (
                  <button
                    type="button"
                    className={`mgo-planner-row ${dragging ? "is-dragging" : ""}`}
                    key={job.id}
                    aria-keyshortcuts="ArrowLeft ArrowRight"
                    onKeyDown={(event) => onRowKeyDown(event, job)}
                    onClick={() => {
                      if (suppressRowClick.current) {
                        suppressRowClick.current = false;
                        return;
                      }
                      setSelectedJobId(job.id);
                    }}
                  >
                    <span className="mgo-planner-row__label">
                      <strong>{job.name}{conflictedIds.has(job.id) ? <em className="mgo-chip mgo-chip--red">Conflict</em> : null}</strong>
                      <small>{team?.name || "Unassigned"} · {job.site}</small>
                    </span>
                    <span className="mgo-planner-row__track">
                      {weeks.map((week) => <i key={week.iso} className={week.iso === currentWeekIso ? "is-current" : ""} />)}
                      {todayOffset === null ? null : <span className="mgo-planner-row__today" style={{ left: `${todayOffset}%` }} aria-hidden="true" />}
                      <span
                        className={`mgo-job-bar mgo-job-bar--${jobTone(job)} ${job.source === "opportunity" ? "mgo-job-bar--ghost" : ""} ${conflictedIds.has(job.id) ? "is-conflicted" : ""} ${dragging ? "is-dragging" : ""}`}
                        style={{ left: `${position.left + shift}%`, width: `${position.width}%`, "--team-colour": team?.colour || "#64748b" }}
                        onPointerDown={(event) => onBarPointerDown(event, job)}
                        onPointerMove={onBarPointerMove}
                        onPointerUp={endBarDrag}
                        onPointerCancel={endBarDrag}
                        title={`Drag to reschedule ${job.name}, or focus the row and use the arrow keys`}
                      >
                        <b>{job.name}</b>
                        <small>{preview ? `${dateLabel(preview.start)} – ${dateLabel(preview.end)}` : `${readinessForJob(job)}% ready`}</small>
                      </span>
                    </span>
                  </button>
                );
              })}
              {!plannerRows.length ? (
                <div className="mgo-empty mgo-empty--planner">
                  <CalendarDays size={28} />
                  <strong>{filtersActive ? "No work matches these filters" : "Your 90-day planner is ready"}</strong>
                  <span>{filtersActive ? "Clear the filters to see the full programme." : "Add dates to existing projects or create potential work."}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mgo-planner-legend">
            <span><i className="is-green" /> Confirmed &amp; ready</span>
            <span><i className="is-amber" /> Needs information</span>
            <span><i className="is-red" /> Blocked or delayed</span>
            <span><i className="is-ghost" /> Pipeline opportunity</span>
            <span><i className="is-today" /> Today</span>
            <span className="mgo-planner-legend__hint">Drag a bar to reschedule · focus a row and use ← → (hold Shift for a week)</span>
          </div>
        </section>
      ) : null}

      {tab === "scenario" ? (
        <Suspense fallback={<div className="mgo-tab-loading">Loading the scenario planner…</div>}>
          <ScenarioTab
            jobs={jobs}
            teams={state.teams}
            draft={scenarioDraft}
            setDraft={setScenarioDraft}
            selectJob={selectScenarioJob}
            job={scenarioJob}
            team={scenarioTeam}
            conflicts={scenarioConflicts}
            capacityBefore={scenarioCapacityBefore}
            capacityAfter={scenarioCapacityAfter}
            capacityMonths={capacityMonths}
            onApply={applyScenario}
            teamName={teamName}
          />
        </Suspense>
      ) : null}

      {tab === "teams" ? (
        <div className="mgo-teams-layout">
          <section className="mgo-panel">
            <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Editable setup</span><h2>Teams &amp; crew</h2><p>Names, colours, regions, working capacity and who is actually in each crew.</p></div><button type="button" className="mgo-btn mgo-btn--primary" onClick={addTeam}><Plus size={14} /> Add team</button></div>

            {crewIssues.empty.length || crewIssues.expired.length ? (
              <div className="mgo-crew-alert" role="status">
                <AlertTriangle size={15} />
                <div>
                  {crewIssues.empty.length ? <p><strong>{crewIssues.empty.map((team) => team.name).join(", ")}</strong> {plural(crewIssues.empty.length, "has", "have")} work booked but nobody rostered.</p> : null}
                  {crewIssues.expired.length ? <p>{crewIssues.expired.map((row) => `${row.team.name}: ${row.expired} ${plural(row.expired, "crew member")} with expired certification`).join(" · ")}.</p> : null}
                </div>
              </div>
            ) : null}

            <div className="mgo-team-list">
              {state.teams.map((team) => {
                const crew = crewByTeam.get(team.id);
                return (
                  <article key={team.id} className="mgo-team-card" style={{ "--team-colour": team.colour }}>
                    <label className="mgo-team-card__colour" title="Team colour"><input type="color" value={team.colour} onChange={(e) => updateTeam(team.id, { colour: e.target.value })} /><span style={{ background: team.colour }} /></label>
                    <label>Team name<input value={team.name} maxLength={60} onChange={(e) => updateTeam(team.id, { name: e.target.value })} /></label>
                    <label>Region<input value={team.region} maxLength={60} placeholder="e.g. Midlands" onChange={(e) => updateTeam(team.id, { region: e.target.value })} /></label>
                    <label>Working days/week<input type="number" min="1" max="7" value={team.capacity} onChange={(e) => updateTeam(team.id, { capacity: Number(e.target.value) })} /></label>
                    <button type="button" className="mgo-icon-btn" aria-label={`Remove ${team.name}`} onClick={() => setTeamPendingRemoval(team)}><Trash2 size={15} /></button>
                    <details className="mgo-crew">
                      <summary>
                        <HardHat size={14} />
                        <span>{crew?.count ? `${crew.count} ${plural(crew.count, "crew member")}` : "No crew rostered"}</span>
                        {crew?.expired ? <em className="mgo-chip mgo-chip--red">{crew.expired} expired</em> : null}
                        {crew?.expiringSoon ? <em className="mgo-chip mgo-chip--amber">{crew.expiringSoon} expiring</em> : null}
                      </summary>
                      {workers.length ? (
                        <ul className="mgo-crew__list">
                          {workers.map((worker) => {
                            const member = crew?.members.find((row) => String(row.id) === String(worker.id));
                            const alerts = member?.certAlerts || [];
                            return (
                              <li key={worker.id}>
                                <label>
                                  <input type="checkbox" checked={Boolean(member)} onChange={() => toggleTeamMember(team.id, String(worker.id))} />
                                  <span><strong>{worker.name || "Unnamed"}</strong><small>{worker.role || "Role not set"}</small></span>
                                </label>
                                {alerts.some((alert) => alert.severity === "expired")
                                  ? <em className="mgo-chip mgo-chip--red">Expired</em>
                                  : alerts.length ? <em className="mgo-chip mgo-chip--amber">Expiring</em> : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mgo-crew__empty">No operatives in the workers register yet.</p>
                      )}
                      {crew?.missingIds.length ? <p className="mgo-crew__empty">{crew.missingIds.length} rostered {plural(crew.missingIds.length, "member")} no longer exist in the workers register.</p> : null}
                    </details>
                    <details className="mgo-crew mgo-daysoff">
                      <summary>
                        <CalendarDays size={14} />
                        <span>
                          {team.daysOff?.length ? `${team.daysOff.length} ${plural(team.daysOff.length, "period")} off` : "No leave or shutdowns"}
                          {team.worksPublicHolidays ? " · works public holidays" : ` · ${holidays.length} public ${plural(holidays.length, "holiday")}`}
                        </span>
                      </summary>
                      <ul className="mgo-daysoff__list">
                        {(team.daysOff || []).map((row) => (
                          <li key={row.id}>
                            <span><strong>{row.label || "Leave"}</strong><small>{dateLabel(row.from)} – {dateLabel(row.to)}</small></span>
                            <button type="button" aria-label={`Remove ${row.label || "leave"} for ${team.name}`} onClick={() => removeTeamDaysOff(team.id, row.id)}><X size={13} /></button>
                          </li>
                        ))}
                        {team.worksPublicHolidays
                          ? null
                          : holidays.slice(0, 6).map((entry) => (
                            <li key={`holiday-${entry.date}`} className="is-holiday">
                              <span><strong>{entry.name}</strong><small>{dateLabel(entry.date)}{entry.substitute ? " · substitute day" : ""}</small></span>
                              <em>Public holiday</em>
                            </li>
                          ))}
                      </ul>
                      <label className="mgo-daysoff__toggle">
                        <input type="checkbox" checked={Boolean(team.worksPublicHolidays)} onChange={(event) => updateTeam(team.id, { worksPublicHolidays: event.target.checked })} />
                        <span>This crew works public holidays</span>
                      </label>
                      <form
                        className="mgo-daysoff__form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = event.currentTarget;
                          // FormData rather than named property access: a field called "label"
                          // is ambiguous on a form element.
                          const fields = new FormData(form);
                          addTeamDaysOff(team.id, String(fields.get("from") || ""), String(fields.get("to") || ""), String(fields.get("label") || ""));
                          form.reset();
                        }}
                      >
                        <label>Reason<input name="label" maxLength={60} placeholder="Shutdown, leave, holiday" /></label>
                        <label>From<input name="from" type="date" required /></label>
                        <label>To<input name="to" type="date" /></label>
                        <button className="mgo-btn mgo-btn--ghost"><Plus size={13} /> Add</button>
                      </form>
                    </details>
                  </article>
                );
              })}
              {!state.teams.length ? <div className="mgo-empty"><Users size={25} /><strong>No teams yet</strong><span>Add a team to start planning capacity.</span></div> : null}
            </div>
          </section>
          <aside className="mgo-panel mgo-capacity-detail"><div className="mgo-panel__head"><div><span className="mgo-eyebrow">Three-month outlook</span><h2>Capacity forecast</h2></div></div>{capacityRows.map(({ team, values }) => <div key={team.id} className="mgo-capacity-detail__team"><strong><i style={{ background: team.colour }} />{team.name}</strong>{values.map((value, index) => <div key={index}><span>{formatMonth(capacityMonths[index])}<b>{value.percentage}%</b></span><em><i className={value.percentage > 100 ? "is-over" : value.percentage < 60 ? "is-gap" : ""} style={{ width: `${Math.min(100, value.percentage)}%` }} /></em><small>{value.booked} of {value.total} team-days booked{value.lostDays ? ` · ${value.lostDays} off` : ""}</small></div>)}</div>)}</aside>
        </div>
      ) : null}

      {tab === "clients" ? (
        <Suspense fallback={<div className="mgo-tab-loading">Loading the client view…</div>}>
          <ClientsTab rows={clientRows} summary={clientSummary} money={money} tracksValue={tracksValue} onSelectJob={setSelectedJobId} />
        </Suspense>
      ) : null}

      {tab === "calendar" ? (
        <Suspense fallback={<div className="mgo-tab-loading">Loading the calendar hub…</div>}>
          <CalendarTab
            calendar={state.calendar}
            teams={state.teams}
            teamById={teamById}
            jobs={jobs}
            weeks={weeks}
            today={today}
            icsPreviewCount={icsPreviewCount}
            ramsLabel={ramsLabel}
            onUpdateCalendar={updateCalendar}
            onExport={exportCalendar}
            onConnect={setCalendarSetupProvider}
            onSelectJob={setSelectedJobId}
          />
        </Suspense>
      ) : null}

      {tab === "meeting" ? (
        <Suspense fallback={<div className="mgo-tab-loading">Loading meeting mode…</div>}>
          <MeetingTab
            meeting={state.meeting}
            meetings={state.meetings}
            agenda={meetingAgenda}
            step={meetingStep}
            setStep={setMeetingStep}
            briefingParts={briefingParts}
            attentionJobs={attentionJobs}
            completedJobs={completedJobs}
            scheduledJobs={scheduledJobs}
            capacityRows={capacityRows}
            capacityMonths={capacityMonths}
            sortedActions={sortedActions}
            newAction={newAction}
            setNewAction={setNewAction}
            onAddAction={addMeetingAction}
            onUpdateAction={updateMeetingAction}
            onRemoveAction={removeMeetingAction}
            onUpdateMeeting={updateMeeting}
            onArchive={archiveMeeting}
            onDeleteArchived={deleteArchivedMeeting}
            onExportPack={exportBoardPack}
            exportBusy={exportBusy}
            todayIso={todayIso}
            today={today}
            teamName={teamName}
            onSelectJob={setSelectedJobId}
          />
        </Suspense>
      ) : null}

      {tab === "group" ? (
        <Suspense fallback={<div className="mgo-tab-loading">Loading the group view…</div>}>
          <GroupTab rollup={rollup} error={rollupError} busy={rollupBusy} onRefresh={() => setRollupToken((token) => token + 1)} />
        </Suspense>
      ) : null}
      </div>

      {selectedJob ? (
        <div className="mgo-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}>
          <aside className="mgo-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="mgo-job-title">
            <div className="mgo-drawer__nav">
              <button type="button" onClick={() => stepJob(-1)} disabled={selectedIndex <= 0} aria-label="Previous job"><ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /></button>
              <span>{selectedIndex + 1} of {navigableJobs.length}</span>
              <button type="button" onClick={() => stepJob(1)} disabled={selectedIndex < 0 || selectedIndex >= navigableJobs.length - 1} aria-label="Next job"><ChevronRight size={15} /></button>
            </div>
            <button type="button" className="mgo-drawer__close" onClick={closeDrawer} aria-label="Close job editor"><X size={18} /></button>
            <span className="mgo-eyebrow">{selectedJob.source === "opportunity" ? "Pipeline opportunity" : "Scheduled project"}</span>
            <h2 id="mgo-job-title">{selectedJob.name}</h2>
            <p>{selectedJob.client} · {selectedJob.site}</p>
            {conflictedIds.has(selectedJob.id) ? (
              <p className="mgo-drawer__warning"><ShieldAlert size={14} /> This job shares its team and dates with other work. Check the planner before confirming.</p>
            ) : null}
            <div className="mgo-drawer__score"><ReadinessRing value={readinessForJob(selectedJob)} /><div><strong>Job readiness</strong><span>Update each requirement as the job becomes ready.</span></div></div>
            <div className="mgo-drawer__grid"><label>Start date<input type="date" value={selectedJob.start || ""} onChange={(e) => updateJob(selectedJob.id, { start: e.target.value, readiness: { ...selectedJob.readiness, dates: Boolean(e.target.value && selectedJob.end) } })} /></label><label>Finish date<input type="date" min={selectedJob.start || undefined} value={selectedJob.end || ""} onChange={(e) => updateJob(selectedJob.id, { end: e.target.value, readiness: { ...selectedJob.readiness, dates: Boolean(selectedJob.start && e.target.value) } })} /></label><label>Assigned team<select value={selectedJob.teamId || ""} onChange={(e) => updateJob(selectedJob.id, { teamId: e.target.value, readiness: { ...selectedJob.readiness, team: Boolean(e.target.value) } })}><option value="">Unassigned</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Status<select value={selectedJob.status} onChange={(e) => updateJob(selectedJob.id, { status: e.target.value })}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label><label className="mgo-drawer__value">Contract value ({currencySymbol})<input type="number" min="0" step="100" inputMode="decimal" value={selectedJob.value || ""} placeholder="0" onChange={(e) => updateJob(selectedJob.id, { value: cleanMoney(e.target.value) })} /></label></div>
            <fieldset className="mgo-checklist"><legend>Readiness checklist</legend>{readinessRows.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(selectedJob.readiness[key])} onChange={(e) => updateJob(selectedJob.id, { readiness: { ...selectedJob.readiness, [key]: e.target.checked } })} /><span>{label}</span>{selectedJob.source === "project" && ["rams", "permits", "survey"].includes(key) ? <small>{selectedJob.documentCounts[`${key === "survey" ? "surveys" : key}`]} linked</small> : null}</label>)}</fieldset>
            {selectedJobHistory.length ? (
              <section className="mgo-drawer__history" aria-labelledby="mgo-history-title">
                <h3 id="mgo-history-title"><History size={13} /> Change log</h3>
                <ul>
                  {selectedJobHistory.slice(0, 8).map((entry) => (
                    <li key={entry.id}>
                      <strong>{HISTORY_FIELD_LABELS[entry.field] || entry.field}</strong>
                      <span>{historyValue(entry.field, entry.from)} → {historyValue(entry.field, entry.to)}</span>
                      <small>
                        {entry.byUserId && entry.byUserId === managementSync.currentUserId ? "you" : entry.by || "a colleague"}
                        {" · "}{agoLabel(entry.at, nowMs)}
                      </small>
                    </li>
                  ))}
                </ul>
                {selectedJobHistory.length > 8 ? <p className="mgo-more">+{selectedJobHistory.length - 8} earlier {plural(selectedJobHistory.length - 8, "change")}</p> : null}
              </section>
            ) : null}
            {selectedJob.source === "opportunity" ? <button type="button" className="mgo-btn mgo-btn--danger" onClick={() => removeOpportunity(selectedJob.id)}><Trash2 size={14} /> Remove opportunity</button> : null}
            <div className="mgo-drawer__saved"><CheckCircle2 size={14} /> Changes save automatically</div>
          </aside>
        </div>
      ) : null}

      {calendarSetupProvider ? (
        <div className="mgo-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCalendarSetup(); }}>
          <aside className="mgo-calendar-setup" ref={calendarSetupRef} role="dialog" aria-modal="true" aria-labelledby="mgo-calendar-setup-title">
            <button type="button" className="mgo-drawer__close" onClick={closeCalendarSetup} aria-label="Close calendar connection setup"><X size={18} /></button>
            <span className={`mgo-calendar-setup__provider mgo-calendar-setup__provider--${calendarSetupProvider}`}>{calendarSetupProvider === "microsoft" ? "Microsoft 365" : "Google Workspace"}</span>
            <h2 id="mgo-calendar-setup-title">Secure calendar connection</h2>
            <p>The visual Calendar Hub is ready. Live two-way sync needs the organisation’s calendar app connection to be configured before managers can authorise access.</p>
            <ol><li><span><ShieldCheck size={15} /></span><div><strong>Management authorises access</strong><small>MySafeOps requests calendar-only permissions.</small></div></li><li><span><Layers3 size={15} /></span><div><strong>MySafeOps calendars are created</strong><small>Management, teams and compliance stay separated.</small></div></li><li><span><RefreshCw size={15} /></span><div><strong>Changes sync automatically</strong><small>Reschedules and cancellations update the same event.</small></div></li></ol>
            <div className="mgo-calendar-setup__notice"><LockKeyhole size={15} /><span><strong>No connection has been made yet.</strong> Provider credentials and the secure callback must be added server-side.</span></div>
            <button type="button" className="mgo-btn mgo-btn--primary" onClick={closeCalendarSetup}>Keep this ready for connection</button>
          </aside>
        </div>
      ) : null}

      {undo ? (
        <div className="mgo-undo" role="status">
          <span>{undo.label} — undo?</span>
          <button type="button" onClick={applyUndo}>Undo</button>
          <button type="button" className="mgo-undo__dismiss" onClick={() => setUndo(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(teamPendingRemoval)}
        title="Remove team"
        message={`Remove ${teamPendingRemoval?.name || "this team"}? Jobs assigned to it will become unassigned.`}
        confirmLabel="Remove team"
        tone="danger"
        zIndex={1300}
        onConfirm={confirmRemoveTeam}
        onCancel={() => setTeamPendingRemoval(null)}
      />
    </div>
  );
}
