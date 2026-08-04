import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Edit3,
  GitCompareArrows,
  LayoutDashboard,
  Layers3,
  ListTodo,
  LockKeyhole,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Pause,
  Play,
  Plus,
  Presentation,
  Radio,
  SkipForward,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { collectProjectDashboard } from "../utils/projectDashboard";
import { loadOrgScoped, ORG_DATA_CHANGED_EVENT } from "../utils/orgStorage";
import { isSuperAdminEmail } from "../utils/superAdmin";
import {
  addDays,
  buildPlannerWeeks,
  dateOnly,
  isoDate,
  jobTone,
  loadManagementState,
  monthCapacity,
  plannerPosition,
  readinessForJob,
  saveManagementState,
} from "../utils/managementOverview";
import "../styles/management-overview.css";

const PROJECTS_KEY = "mysafeops_projects";
const WORKERS_KEY = "mysafeops_workers";
const STATUS_OPTIONS = ["provisional", "confirmed", "blocked", "delayed", "completed", "cancelled"];
const READINESS_FIELDS = [
  ["dates", "Dates confirmed"],
  ["team", "Team assigned"],
  ["rams", "RAMS ready"],
  ["permits", "Permits ready"],
  ["survey", "Survey complete"],
  ["client", "Client confirmed"],
];
const FOCUS_VIEWS = ["overview", "planner", "teams"];
const FOCUS_VIEW_LABELS = { overview: "Command overview", planner: "90-day programme", teams: "Team capacity" };

const gbDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const shortMonthLabel = new Intl.DateTimeFormat("en-GB", { month: "short" });

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function liveOrgArrayRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row?.id && !row.deletedAt);
}

function dateLabel(value) {
  const date = dateOnly(value);
  return date ? gbDate.format(date) : "Not set";
}

const UK_LOCATION_POSITIONS = [
  { terms: ["glasgow", "edinburgh", "scotland"], x: 48, y: 18 },
  { terms: ["newcastle", "tyne", "durham"], x: 67, y: 34 },
  { terms: ["manchester", "liverpool", "leeds", "yorkshire"], x: 47, y: 45 },
  { terms: ["birmingham", "midlands", "nottingham", "leicester"], x: 53, y: 61 },
  { terms: ["cardiff", "wales", "bristol"], x: 31, y: 72 },
  { terms: ["london", "essex", "kent", "surrey"], x: 68, y: 79 },
  { terms: ["southampton", "portsmouth", "bournemouth"], x: 49, y: 85 },
];

function regionalPosition(job, index) {
  const location = `${job.site || ""} ${job.project?.postcode || ""}`.toLowerCase();
  const match = UK_LOCATION_POSITIONS.find((region) => region.terms.some((term) => location.includes(term)));
  if (match) return match;
  const seed = [...location].reduce((sum, character) => sum + character.charCodeAt(0), index * 29);
  return { x: 30 + (seed % 43), y: 27 + ((seed * 7) % 54) };
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  const aStart = dateOnly(firstStart);
  const aEnd = dateOnly(firstEnd || firstStart);
  const bStart = dateOnly(secondStart);
  const bEnd = dateOnly(secondEnd || secondStart);
  return Boolean(aStart && aEnd && bStart && bEnd && aStart <= bEnd && bStart <= aEnd);
}

function buildReadiness(project, dash, jobConfig) {
  if (jobConfig?.readiness) return jobConfig.readiness;
  return {
    dates: Boolean(project.timelineStart && project.timelineEnd),
    team: Boolean(jobConfig?.teamId),
    rams: dash.rams.length > 0,
    permits: dash.permitReady.complete,
    survey: dash.surveys.length > 0,
    client: Boolean(project.client),
  };
}

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

function MetricCard({ icon: Icon, value, label, tone = "default", detail }) {
  return (
    <article className={`mgo-metric mgo-metric--${tone}`}>
      <span className="mgo-metric__icon"><Icon size={18} /></span>
      <div><strong>{value}</strong><span>{label}</span></div>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function ReadinessRing({ value, size = "normal" }) {
  const tone = value === 100 ? "green" : value < 50 ? "red" : "amber";
  return (
    <span className={`mgo-readiness mgo-readiness--${tone} mgo-readiness--${size}`} style={{ "--readiness": `${value * 3.6}deg` }}>
      <span>{value}%</span>
    </span>
  );
}

export default function ManagementOverview() {
  const { role } = useApp();
  const { user } = useSupabaseAuth();
  const canView = role === "admin" || isSuperAdminEmail(user?.email);
  const [state, setState] = useState(loadManagementState);
  const [projects, setProjects] = useState(() => liveOrgArrayRows(loadOrgScoped(PROJECTS_KEY, [])));
  const [workers, setWorkers] = useState(() => liveOrgArrayRows(loadOrgScoped(WORKERS_KEY, [])));
  const [tab, setTab] = useState("overview");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [calendarSetupProvider, setCalendarSetupProvider] = useState("");
  const [meetingStep, setMeetingStep] = useState(0);
  const [newAction, setNewAction] = useState({ text: "", owner: "", due: "" });
  const [exportBusy, setExportBusy] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusAutoPlay, setFocusAutoPlay] = useState(false);
  const [scenarioDraft, setScenarioDraft] = useState({ jobId: "", teamId: "", start: "", end: "" });
  const [opportunityDraft, setOpportunityDraft] = useState({ name: "", client: "", site: "", start: "", end: "", teamId: "" });
  const weeks = useMemo(() => buildPlannerWeeks(new Date(), 13), []);

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

  useEffect(() => {
    if (canView) saveManagementState(state);
  }, [state, canView]);

  useEffect(() => {
    if (!focusMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setFocusAutoPlay(false);
      setFocusMode(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode || !focusAutoPlay) return undefined;
    const timer = window.setInterval(() => {
      setTab((current) => {
        const currentIndex = FOCUS_VIEWS.indexOf(current);
        return FOCUS_VIEWS[(currentIndex + 1) % FOCUS_VIEWS.length];
      });
    }, 12000);
    return () => window.clearInterval(timer);
  }, [focusMode, focusAutoPlay]);

  const jobs = useMemo(() => {
    const projectJobs = projects.map((project) => {
      const config = state.jobs[project.id] || {};
      const dash = collectProjectDashboard(project, workers);
      return {
        id: project.id,
        name: project.name || "Unnamed project",
        client: project.client || "Client not set",
        site: project.site || project.address || project.postcode || "Location not set",
        start: config.start || project.timelineStart || "",
        end: config.end || project.timelineEnd || project.timelineStart || "",
        teamId: config.teamId || "",
        status: config.status || "provisional",
        readiness: buildReadiness(project, dash, config),
        source: "project",
        project,
        documentCounts: { rams: dash.rams.length, permits: dash.permits.length, surveys: dash.surveys.length },
      };
    });
    const opportunities = state.opportunities.map((opportunity) => ({
      ...opportunity,
      readiness: opportunity.readiness || { dates: true, team: Boolean(opportunity.teamId), rams: false, permits: false, survey: false, client: false },
      status: opportunity.status || "provisional",
      source: "opportunity",
      documentCounts: { rams: 0, permits: 0, surveys: 0 },
    }));
    return [...projectJobs, ...opportunities];
  }, [projects, workers, state.jobs, state.opportunities]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;
  const today = useMemo(() => dateOnly(isoDate(new Date())), []);
  const inNinetyDays = useMemo(() => addDays(today, 90), [today]);
  const fourWeeksAgo = useMemo(() => addDays(today, -28), [today]);
  const scheduledJobs = jobs.filter((job) => {
    const start = dateOnly(job.start);
    return start && start >= today && start <= inNinetyDays && job.status !== "cancelled";
  });
  const completedJobs = jobs.filter((job) => {
    const end = dateOnly(job.end);
    return job.status === "completed" && end && end >= fourWeeksAgo && end <= today;
  });
  const attentionJobs = jobs.filter((job) => job.status !== "completed" && job.status !== "cancelled" && jobTone(job) !== "green");

  const capacityMonths = useMemo(() => {
    const result = [];
    for (let offset = 0; offset < 3; offset += 1) {
      result.push(new Date(today.getFullYear(), today.getMonth() + offset, 1, 12));
    }
    return result;
  }, [today]);

  const capacityRows = useMemo(
    () => state.teams.map((team) => ({ team, values: capacityMonths.map((month) => monthCapacity(jobs, team, month)) })),
    [state.teams, capacityMonths, jobs]
  );
  const capacityValues = capacityRows.flatMap((row) => row.values.map((value) => value.percentage));
  const overallCapacity = capacityValues.length ? Math.round(capacityValues.reduce((sum, value) => sum + value, 0) / capacityValues.length) : 0;
  const diaryGaps = capacityRows.reduce((sum, row) => sum + row.values.filter((value) => value.percentage < 60).length, 0);
  const gapSuggestion = useMemo(() => {
    const choices = capacityRows.flatMap((row) => row.values.map((value, index) => ({ team: row.team, value, month: capacityMonths[index] })));
    return choices.sort((a, b) => a.value.percentage - b.value.percentage)[0] || null;
  }, [capacityRows, capacityMonths]);
  const suggestedOpportunity = state.opportunities.find((job) => !job.teamId) || state.opportunities[0] || null;
  const mapJobs = scheduledJobs.slice(0, 12).map((job, index) => ({ ...job, position: regionalPosition(job, index) }));
  const openActions = state.meeting.actions.filter((action) => action.status !== "Done");
  const briefingParts = [
    `${scheduledJobs.length} ${scheduledJobs.length === 1 ? "job is" : "jobs are"} scheduled in the next 90 days.`,
    attentionJobs.length ? `${attentionJobs.length} ${attentionJobs.length === 1 ? "job requires" : "jobs require"} management attention.` : "No jobs currently require management intervention.",
    gapSuggestion ? `${gapSuggestion.team.name} has the clearest capacity opportunity in ${monthLabel.format(gapSuggestion.month)}.` : "Add teams to begin capacity forecasting.",
    openActions.length ? `${openActions.length} management ${openActions.length === 1 ? "action remains" : "actions remain"} open.` : "There are no open management actions.",
  ];
  const scenarioJob = jobs.find((job) => job.id === scenarioDraft.jobId) || null;
  const scenarioTeam = state.teams.find((team) => team.id === scenarioDraft.teamId) || null;
  const scenarioPreviewJobs = scenarioJob ? jobs.map((job) => job.id === scenarioJob.id ? { ...job, teamId: scenarioDraft.teamId, start: scenarioDraft.start, end: scenarioDraft.end } : job) : jobs;
  const scenarioCapacityBefore = scenarioTeam ? capacityMonths.map((month) => monthCapacity(jobs, scenarioTeam, month)) : [];
  const scenarioCapacityAfter = scenarioTeam ? capacityMonths.map((month) => monthCapacity(scenarioPreviewJobs, scenarioTeam, month)) : [];
  const scenarioConflicts = scenarioJob && scenarioDraft.teamId ? jobs.filter((job) => job.id !== scenarioJob.id && job.teamId === scenarioDraft.teamId && job.status !== "cancelled" && rangesOverlap(scenarioDraft.start, scenarioDraft.end, job.start, job.end)) : [];
  const meetingAgenda = [
    { label: "Executive briefing", value: `${scheduledJobs.length} jobs in the next 90 days`, detail: `${attentionJobs.length} currently require attention` },
    { label: "Completed work", value: `${completedJobs.length} completed`, detail: "Recorded during the last four weeks" },
    { label: "Upcoming programme", value: `${scheduledJobs.length} scheduled`, detail: `${state.opportunities.length} pipeline opportunities` },
    { label: "Capacity & gaps", value: `${overallCapacity}% average capacity`, detail: `${diaryGaps} low-capacity month slots` },
    { label: "Decisions required", value: `${attentionJobs.length} jobs`, detail: "Readiness, delay or assignment decision" },
    { label: "Actions agreed", value: `${state.meeting.actions.filter((action) => action.status !== "Done").length} open actions`, detail: `${state.meeting.actions.filter((action) => action.status === "Done").length} completed` },
  ];

  const updateJob = (jobId, patch) => {
    const opportunityIndex = state.opportunities.findIndex((job) => job.id === jobId);
    if (opportunityIndex >= 0) {
      setState((current) => ({
        ...current,
        opportunities: current.opportunities.map((job) => job.id === jobId ? { ...job, ...patch } : job),
      }));
      return;
    }
    setState((current) => ({ ...current, jobs: { ...current.jobs, [jobId]: { ...current.jobs[jobId], ...patch } } }));
  };

  const selectScenarioJob = (jobId) => {
    const job = jobs.find((item) => item.id === jobId);
    setScenarioDraft(job ? { jobId: job.id, teamId: job.teamId || "", start: job.start || "", end: job.end || job.start || "" } : { jobId: "", teamId: "", start: "", end: "" });
  };

  const applyScenario = () => {
    if (!scenarioJob || !scenarioDraft.start || !scenarioDraft.end || scenarioDraft.end < scenarioDraft.start) return;
    updateJob(scenarioJob.id, {
      teamId: scenarioDraft.teamId,
      start: scenarioDraft.start,
      end: scenarioDraft.end,
      readiness: { ...scenarioJob.readiness, dates: true, team: Boolean(scenarioDraft.teamId) },
    });
    setTab("planner");
  };

  const nextFocusView = () => {
    setTab((current) => {
      const currentIndex = FOCUS_VIEWS.indexOf(current);
      return FOCUS_VIEWS[(currentIndex + 1) % FOCUS_VIEWS.length];
    });
  };

  const addTeam = () => {
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

  const updateCalendar = (patch) => {
    setState((current) => ({ ...current, calendar: { ...current.calendar, ...patch } }));
  };

  const updateMeeting = (patch) => {
    setState((current) => ({ ...current, meeting: { ...current.meeting, ...patch } }));
  };

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

  const removeTeam = (teamId) => {
    if (!window.confirm("Remove this team? Existing jobs will become unassigned.")) return;
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
    const start = opportunityDraft.start || isoDate(addDays(today, 14));
    const end = opportunityDraft.end || isoDate(addDays(dateOnly(start), 4));
    const opportunity = {
      id: id("opportunity"),
      ...opportunityDraft,
      name: opportunityDraft.name.trim(),
      client: opportunityDraft.client.trim() || "Prospective client",
      site: opportunityDraft.site.trim() || "Location to confirm",
      start,
      end,
      status: "provisional",
      readiness: { dates: true, team: Boolean(opportunityDraft.teamId), rams: false, permits: false, survey: false, client: false },
    };
    setState((current) => ({ ...current, opportunities: [...current.opportunities, opportunity] }));
    setOpportunityDraft({ name: "", client: "", site: "", start: "", end: "", teamId: "" });
    setShowOpportunityForm(false);
    setSelectedJobId(opportunity.id);
  };

  const removeOpportunity = (jobId) => {
    setState((current) => ({ ...current, opportunities: current.opportunities.filter((job) => job.id !== jobId) }));
    setSelectedJobId(null);
  };

  const exportCalendar = () => {
    const escapeIcs = (value) => String(value || "").replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");
    const dateStamp = (value) => String(value || "").replaceAll("-", "");
    const events = jobs.filter((job) => job.start && job.status !== "cancelled").map((job) => [
      "BEGIN:VEVENT",
      `UID:${job.id}@mysafeops`,
      `DTSTART;VALUE=DATE:${dateStamp(job.start)}`,
      `DTEND;VALUE=DATE:${dateStamp(isoDate(addDays(dateOnly(job.end || job.start), 1)))}`,
      `SUMMARY:${escapeIcs(job.name)}`,
      `LOCATION:${escapeIcs(job.site)}`,
      `DESCRIPTION:${escapeIcs(`${job.client} · ${readinessForJob(job)}% ready · ${job.status}`)}`,
      "END:VEVENT",
    ].join("\r\n"));
    const blob = new Blob([["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MySafeOps//Management Planner//EN", `X-WR-CALNAME:${escapeIcs(state.calendar.groupName)}`, ...events, "END:VCALENDAR"].join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MySafeOps-management-planner.ics";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBoardPack = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const { buildManagementBoardPackPdf } = await import("../utils/managementBoardPackPdf");
      const teamName = (teamId) => state.teams.find((team) => team.id === teamId)?.name || "Unassigned";
      const pdfJobs = jobs.map((job) => ({
        ...job,
        teamName: teamName(job.teamId),
        readiness: readinessForJob(job),
        tone: jobTone(job),
      }));
      await buildManagementBoardPackPdf({
        periodLabel: `${dateLabel(isoDate(today))} - ${dateLabel(isoDate(inNinetyDays))}`,
        metrics: { scheduled: scheduledJobs.length, attention: attentionJobs.length, capacity: overallCapacity, gaps: diaryGaps },
        briefing: gapSuggestion
          ? `${attentionJobs.length} job(s) require management attention. ${gapSuggestion.team.name} is ${gapSuggestion.value.percentage}% booked in ${monthLabel.format(gapSuggestion.month)}. ${suggestedOpportunity ? `${suggestedOpportunity.name} could be reviewed as potential gap-filling work.` : "Review the pipeline for suitable work."}`
          : "No immediate capacity exception has been identified.",
        jobs: pdfJobs,
        attentionJobs: pdfJobs.filter((job) => job.status !== "completed" && job.status !== "cancelled" && job.tone !== "green"),
        capacityRows: capacityRows.map((row) => ({ teamName: row.team.name, region: row.team.region, values: row.values })),
        months: capacityMonths.map((month) => monthLabel.format(month)),
        meeting: state.meeting,
      });
    } finally {
      setExportBusy(false);
    }
  };

  if (!canView) return <ManagementRestricted />;

  return (
    <div className={`mgo ${focusMode ? "mgo--focus" : ""}`}>
      <header className="mgo-hero">
        <div className="mgo-hero__copy">
          <div className="mgo-eyebrow"><LockKeyhole size={12} /> Private management workspace</div>
          <h1>Management overview</h1>
          <p>Your next 90 days, team capacity and H&amp;S readiness in one operational view.</p>
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

      <nav className="mgo-tabs" aria-label="Management overview sections">
        {[["overview", LayoutDashboard, "Overview"], ["planner", CalendarDays, "90-day planner"], ["scenario", GitCompareArrows, "Scenario planner"], ["teams", Users, "Teams & capacity"], ["calendar", CalendarCheck2, "Calendar sync"], ["meeting", Presentation, "Meeting mode"]].map(([value, Icon, label]) => (
          <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => { setTab(value); if (value === "scenario" && !scenarioDraft.jobId && jobs.length) selectScenarioJob(scheduledJobs[0]?.id || jobs[0].id); }}><Icon size={15} />{label}</button>
        ))}
      </nav>

      {showOpportunityForm ? (
        <form className="mgo-opportunity-form" onSubmit={addOpportunity}>
          <div><span className="mgo-eyebrow">Pipeline</span><h2>Add potential work</h2><p>Potential work appears as a ghost job until it is confirmed.</p></div>
          <label>Job name<input autoFocus value={opportunityDraft.name} onChange={(e) => setOpportunityDraft((d) => ({ ...d, name: e.target.value }))} required /></label>
          <label>Client<input value={opportunityDraft.client} onChange={(e) => setOpportunityDraft((d) => ({ ...d, client: e.target.value }))} /></label>
          <label>Location<input value={opportunityDraft.site} onChange={(e) => setOpportunityDraft((d) => ({ ...d, site: e.target.value }))} /></label>
          <label>Start<input type="date" value={opportunityDraft.start} onChange={(e) => setOpportunityDraft((d) => ({ ...d, start: e.target.value }))} /></label>
          <label>Finish<input type="date" value={opportunityDraft.end} onChange={(e) => setOpportunityDraft((d) => ({ ...d, end: e.target.value }))} /></label>
          <label>Preferred team<select value={opportunityDraft.teamId} onChange={(e) => setOpportunityDraft((d) => ({ ...d, teamId: e.target.value }))}><option value="">Unassigned</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <div className="mgo-opportunity-form__actions"><button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setShowOpportunityForm(false)}>Cancel</button><button className="mgo-btn mgo-btn--primary">Add to planner</button></div>
        </form>
      ) : null}

      {tab === "overview" ? (
        <>
          <section className="mgo-metrics" aria-label="Management summary">
            <MetricCard icon={BriefcaseBusiness} value={scheduledJobs.length} label="jobs in next 90 days" detail={`${state.opportunities.length} pipeline opportunities`} />
            <MetricCard icon={CheckCircle2} value={completedJobs.length} label="completed in 4 weeks" tone="green" detail="Based on completed status" />
            <MetricCard icon={Clock3} value={diaryGaps} label="capacity gaps" tone="blue" detail="Months below 60% booked" />
            <MetricCard icon={AlertTriangle} value={attentionJobs.length} label="jobs need attention" tone={attentionJobs.length ? "red" : "green"} detail="Missing readiness or delayed" />
            <MetricCard icon={Users} value={`${overallCapacity}%`} label="average capacity" tone={overallCapacity > 100 ? "red" : "purple"} detail="Across the next 3 months" />
          </section>

          <section className="mgo-briefing" aria-labelledby="mgo-briefing-title">
            <div className="mgo-briefing__signal"><Sparkles size={19} /><i /></div>
            <div className="mgo-briefing__copy">
              <span className="mgo-eyebrow">Live management briefing</span>
              <h2 id="mgo-briefing-title">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}.</h2>
              <p>{briefingParts.join(" ")}</p>
            </div>
            <div className="mgo-briefing__date"><strong>{gbDate.format(today)}</strong><span>Live operational view</span></div>
          </section>

          <section className="mgo-smart-card">
            <div className="mgo-smart-card__icon"><Sparkles size={20} /></div>
            <div className="mgo-smart-card__copy">
              <span>Smart gap finder</span>
              {gapSuggestion ? <h2>{gapSuggestion.team.name} is only {gapSuggestion.value.percentage}% booked in {monthLabel.format(gapSuggestion.month)}.</h2> : <h2>Add your first team to start capacity planning.</h2>}
              <p>{suggestedOpportunity ? `${suggestedOpportunity.name} could be reviewed as potential gap-filling work.` : "Add potential work to the pipeline and MySafeOps will surface the best diary fit."}</p>
            </div>
            {suggestedOpportunity ? <button type="button" className="mgo-btn mgo-btn--smart" onClick={() => setSelectedJobId(suggestedOpportunity.id)}>Review opportunity <ArrowRight size={14} /></button> : <button type="button" className="mgo-btn mgo-btn--smart" onClick={() => setShowOpportunityForm(true)}>Add opportunity <Plus size={14} /></button>}
          </section>

          <div className="mgo-overview-grid">
            <section className="mgo-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Priority queue</span><h2>Requires attention</h2></div><button type="button" onClick={() => setTab("planner")}>Open planner <ChevronRight size={14} /></button></div>
              <div className="mgo-attention-list">
                {attentionJobs.slice(0, 6).map((job) => {
                  const readiness = readinessForJob(job);
                  return <button type="button" key={job.id} className="mgo-attention-row" onClick={() => setSelectedJobId(job.id)}><ReadinessRing value={readiness} size="small" /><span className="mgo-attention-row__copy"><strong>{job.name}</strong><small>{job.teamId ? state.teams.find((team) => team.id === job.teamId)?.name : "No team assigned"} · starts {dateLabel(job.start)}</small></span><span className={`mgo-status mgo-status--${jobTone(job)}`}>{job.status}</span><ChevronRight size={15} /></button>;
                })}
                {!attentionJobs.length ? <div className="mgo-empty"><CheckCircle2 size={24} /><strong>Nothing urgent</strong><span>All scheduled jobs are ready to proceed.</span></div> : null}
              </div>
            </section>

            <section className="mgo-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Live forecast</span><h2>Team capacity</h2></div><button type="button" onClick={() => setTab("teams")}>Edit teams <Edit3 size={13} /></button></div>
              <div className="mgo-capacity-mini">
                <div className="mgo-capacity-mini__header"><span>Team</span>{capacityMonths.map((month) => <span key={month.toISOString()}>{shortMonthLabel.format(month)}</span>)}</div>
                {capacityRows.map(({ team, values }) => <div key={team.id} className="mgo-capacity-mini__row"><strong><i style={{ background: team.colour }} />{team.name}</strong>{values.map((value, index) => <span key={index} className={value.percentage > 100 ? "is-over" : value.percentage < 60 ? "is-gap" : "is-healthy"}><b>{value.percentage}%</b><em><i style={{ width: `${Math.min(100, value.percentage)}%` }} /></em></span>)}</div>)}
              </div>
            </section>
          </div>

          <div className="mgo-command-grid">
            <section className="mgo-panel mgo-risk-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Readiness control</span><h2>Risk &amp; readiness heatmap</h2><p>Select any status to open the job record.</p></div><span className="mgo-live-preview"><i /> Live</span></div>
              <div className="mgo-heatmap">
                <div className="mgo-heatmap__head"><span>Project</span>{READINESS_FIELDS.map(([key, label]) => <span key={key}>{label.replace(" ready", "").replace(" complete", "")}</span>)}</div>
                {scheduledJobs.slice(0, 8).map((job) => <button type="button" className="mgo-heatmap__row" key={job.id} onClick={() => setSelectedJobId(job.id)}><span><strong>{job.name}</strong><small>{dateLabel(job.start)}</small></span>{READINESS_FIELDS.map(([key, label]) => <i key={key} className={job.readiness[key] ? "is-ready" : "is-missing"} title={`${label}: ${job.readiness[key] ? "ready" : "requires attention"}`}>{job.readiness[key] ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}</i>)}</button>)}
                {!scheduledJobs.length ? <div className="mgo-empty"><ShieldCheck size={25} /><strong>No scheduled work to assess</strong><span>Add project dates to populate the readiness heatmap.</span></div> : null}
              </div>
            </section>

            <section className="mgo-panel mgo-map-panel">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Operational footprint</span><h2>UK site activity</h2><p>Regional view based on the project location held in MySafeOps.</p></div><Navigation size={17} /></div>
              <div className="mgo-uk-map" aria-label={`${mapJobs.length} upcoming sites shown in a regional UK view`}>
                <span className="mgo-uk-map__region mgo-uk-map__region--scotland">Scotland</span><span className="mgo-uk-map__region mgo-uk-map__region--north">North</span><span className="mgo-uk-map__region mgo-uk-map__region--midlands">Midlands</span><span className="mgo-uk-map__region mgo-uk-map__region--south">London &amp; South</span>
                {mapJobs.map((job) => { const team = state.teams.find((item) => item.id === job.teamId); return <button type="button" key={job.id} className={`mgo-map-pin mgo-map-pin--${jobTone(job)}`} style={{ left: `${job.position.x}%`, top: `${job.position.y}%`, "--pin-colour": team?.colour || "#0f766e" }} onClick={() => setSelectedJobId(job.id)} aria-label={`Open ${job.name} at ${job.site}`}><MapPin size={18} /><span><strong>{job.name}</strong><small>{job.site}</small></span></button>; })}
                {!mapJobs.length ? <div className="mgo-uk-map__empty"><MapPin size={25} /><strong>No upcoming sites</strong><span>Scheduled projects will appear here.</span></div> : null}
              </div>
              <div className="mgo-map-legend"><span><i className="is-green" />Ready</span><span><i className="is-amber" />Needs information</span><span><i className="is-red" />Blocked</span></div>
            </section>
          </div>
        </>
      ) : null}

      {tab === "planner" ? (
        <section className="mgo-panel mgo-planner-panel">
          <div className="mgo-panel__head mgo-panel__head--planner"><div><span className="mgo-eyebrow">Rolling programme</span><h2>Next 13 weeks</h2><p>Green is confirmed and ready. Amber needs information. Red is blocked. Dashed jobs are pipeline opportunities.</p></div><button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => setShowOpportunityForm(true)}><Plus size={14} /> Potential work</button></div>
          <div className="mgo-planner" style={{ "--weeks": weeks.length }}>
            <div className="mgo-planner__head"><span>Job / team</span><div>{weeks.map((week) => <span key={week.iso}><b>{gbDate.format(week.start)}</b><small>{shortMonthLabel.format(week.start)}</small></span>)}</div></div>
            <div className="mgo-planner__rows">
              {jobs.filter((job) => plannerPosition(job.start, job.end, weeks)).sort((a, b) => String(a.start).localeCompare(String(b.start))).map((job) => {
                const position = plannerPosition(job.start, job.end, weeks);
                const team = state.teams.find((item) => item.id === job.teamId);
                return <button type="button" className="mgo-planner-row" key={job.id} onClick={() => setSelectedJobId(job.id)}><span className="mgo-planner-row__label"><strong>{job.name}</strong><small>{team?.name || "Unassigned"} · {job.site}</small></span><span className="mgo-planner-row__track">{weeks.map((week) => <i key={week.iso} />)}<span className={`mgo-job-bar mgo-job-bar--${jobTone(job)} ${job.source === "opportunity" ? "mgo-job-bar--ghost" : ""}`} style={{ left: `${position.left}%`, width: `${position.width}%`, "--team-colour": team?.colour || "#64748b" }}><b>{job.name}</b><small>{readinessForJob(job)}% ready</small></span></span></button>;
              })}
              {!jobs.some((job) => plannerPosition(job.start, job.end, weeks)) ? <div className="mgo-empty mgo-empty--planner"><CalendarDays size={28} /><strong>Your 90-day planner is ready</strong><span>Add dates to existing projects or create potential work.</span></div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "scenario" ? (
        <section className="mgo-scenario">
          <header className="mgo-scenario__hero">
            <div><span className="mgo-eyebrow">Safe planning sandbox</span><h2>What if we move this job?</h2><p>Test dates and team allocation without changing the live programme. Nothing is saved until you apply the scenario.</p></div>
            <span><GitCompareArrows size={22} /> Draft scenario</span>
          </header>
          <div className="mgo-scenario__layout">
            <section className="mgo-panel mgo-scenario__controls">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Proposed change</span><h2>Build scenario</h2></div></div>
              <label>Project or opportunity<select value={scenarioDraft.jobId} onChange={(event) => selectScenarioJob(event.target.value)}><option value="">Select work</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}</select></label>
              <div className="mgo-scenario__form-grid">
                <label>Proposed team<select value={scenarioDraft.teamId} onChange={(event) => setScenarioDraft((draft) => ({ ...draft, teamId: event.target.value }))}><option value="">Unassigned</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                <label>Start date<input type="date" value={scenarioDraft.start} onChange={(event) => setScenarioDraft((draft) => ({ ...draft, start: event.target.value }))} /></label>
                <label>Finish date<input type="date" min={scenarioDraft.start} value={scenarioDraft.end} onChange={(event) => setScenarioDraft((draft) => ({ ...draft, end: event.target.value }))} /></label>
              </div>
              {scenarioJob ? <div className="mgo-scenario__current"><span>Current programme</span><strong>{state.teams.find((team) => team.id === scenarioJob.teamId)?.name || "Unassigned"}</strong><small>{dateLabel(scenarioJob.start)} to {dateLabel(scenarioJob.end)}</small></div> : null}
              <div className="mgo-scenario__actions"><button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => scenarioJob && selectScenarioJob(scenarioJob.id)}>Reset</button><button type="button" className="mgo-btn mgo-btn--primary" disabled={!scenarioJob || !scenarioDraft.start || !scenarioDraft.end || scenarioDraft.end < scenarioDraft.start} onClick={applyScenario}>Apply to programme <ArrowRight size={14} /></button></div>
            </section>

            <section className="mgo-panel mgo-scenario__impact">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Instant impact analysis</span><h2>{scenarioJob ? scenarioJob.name : "Select work to begin"}</h2><p>{scenarioTeam ? `Proposed allocation to ${scenarioTeam.name}` : "Choose a team to calculate capacity and conflicts."}</p></div>{scenarioJob ? <ReadinessRing value={readinessForJob(scenarioJob)} size="small" /> : null}</div>
              <div className={`mgo-scenario__verdict ${scenarioConflicts.length ? "is-warning" : "is-clear"}`}><span>{scenarioConflicts.length ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}</span><div><strong>{scenarioConflicts.length ? `${scenarioConflicts.length} scheduling ${scenarioConflicts.length === 1 ? "conflict" : "conflicts"} detected` : "No scheduling conflict detected"}</strong><small>{scenarioConflicts.length ? scenarioConflicts.map((job) => job.name).join(", ") : "The proposed team has no overlapping jobs in this period."}</small></div></div>
              <div className="mgo-scenario__capacity">
                <div className="mgo-scenario__capacity-head"><span>Proposed team capacity</span><small>Before → after</small></div>
                {capacityMonths.map((month, index) => { const before = scenarioCapacityBefore[index]?.percentage || 0; const after = scenarioCapacityAfter[index]?.percentage || 0; return <article key={month.toISOString()}><span><strong>{shortMonthLabel.format(month)}</strong><small>{before}%</small><ArrowRight size={12} /><b className={after > 100 ? "is-over" : after < 60 ? "is-gap" : ""}>{after}%</b></span><em><i style={{ width: `${Math.min(100, after)}%` }} /></em></article>; })}
              </div>
              <div className="mgo-scenario__notice"><LockKeyhole size={14} /><span><strong>Simulation only</strong><small>Your live planner remains unchanged until “Apply to programme” is selected.</small></span></div>
            </section>
          </div>
        </section>
      ) : null}

      {tab === "teams" ? (
        <div className="mgo-teams-layout">
          <section className="mgo-panel">
            <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Editable setup</span><h2>Teams</h2><p>Names, colours, regions and working capacity are private to management.</p></div><button type="button" className="mgo-btn mgo-btn--primary" onClick={addTeam}><Plus size={14} /> Add team</button></div>
            <div className="mgo-team-list">
              {state.teams.map((team) => <article key={team.id} className="mgo-team-card" style={{ "--team-colour": team.colour }}><label className="mgo-team-card__colour" title="Team colour"><input type="color" value={team.colour} onChange={(e) => updateTeam(team.id, { colour: e.target.value })} /><span style={{ background: team.colour }} /></label><label>Team name<input value={team.name} onChange={(e) => updateTeam(team.id, { name: e.target.value })} /></label><label>Region<input value={team.region} placeholder="e.g. Midlands" onChange={(e) => updateTeam(team.id, { region: e.target.value })} /></label><label>Working days/week<input type="number" min="1" max="7" value={team.capacity} onChange={(e) => updateTeam(team.id, { capacity: Number(e.target.value) })} /></label><button type="button" className="mgo-icon-btn" aria-label={`Remove ${team.name}`} onClick={() => removeTeam(team.id)}><Trash2 size={15} /></button></article>)}
            </div>
          </section>
          <aside className="mgo-panel mgo-capacity-detail"><div className="mgo-panel__head"><div><span className="mgo-eyebrow">Three-month outlook</span><h2>Capacity forecast</h2></div></div>{capacityRows.map(({ team, values }) => <div key={team.id} className="mgo-capacity-detail__team"><strong><i style={{ background: team.colour }} />{team.name}</strong>{values.map((value, index) => <div key={index}><span>{monthLabel.format(capacityMonths[index])}<b>{value.percentage}%</b></span><em><i className={value.percentage > 100 ? "is-over" : value.percentage < 60 ? "is-gap" : ""} style={{ width: `${Math.min(100, value.percentage)}%` }} /></em><small>{value.booked} of {value.total} team-days booked</small></div>)}</div>)}</aside>
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="mgo-calendar-hub">
          <section className="mgo-calendar-connect">
            <div className="mgo-calendar-connect__copy">
              <span className="mgo-eyebrow">Calendar hub</span>
              <h2>Your programme, grouped under MySafeOps</h2>
              <p>Connect one provider and keep the management programme, team diaries and compliance deadlines together — without flooding anyone’s personal calendar.</p>
            </div>
            <div className="mgo-provider-grid">
              <article className="mgo-provider mgo-provider--microsoft">
                <span className="mgo-provider__mark" aria-hidden><i /><i /><i /><i /></span>
                <div><strong>Microsoft 365</strong><small>Outlook Calendar</small></div>
                <span className="mgo-provider__state">Ready to connect</span>
                <button type="button" onClick={() => setCalendarSetupProvider("microsoft")}>Connect Outlook</button>
              </article>
              <article className="mgo-provider mgo-provider--google">
                <span className="mgo-provider__g" aria-hidden>G</span>
                <div><strong>Google Workspace</strong><small>Google Calendar</small></div>
                <span className="mgo-provider__state">Ready to connect</span>
                <button type="button" onClick={() => setCalendarSetupProvider("google")}>Connect Google</button>
              </article>
            </div>
          </section>

          <div className="mgo-calendar-layout">
            <section className="mgo-panel mgo-calendar-preview">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Calendar structure</span><h2>How it will appear</h2></div><span className="mgo-live-preview"><i /> Live preview</span></div>
              <div className="mgo-calendar-window">
                <div className="mgo-calendar-window__top"><div className="mgo-calendar-window__brand"><span>M</span><strong>{state.calendar.groupName || "MySafeOps"}</strong></div><div className="mgo-calendar-window__month"><button type="button" aria-label="Previous month">‹</button><strong>{monthLabel.format(today)}</strong><button type="button" aria-label="Next month">›</button></div><span>Week</span></div>
                <div className="mgo-calendar-window__body">
                  <aside className="mgo-calendar-tree">
                    <strong><Layers3 size={13} />{state.calendar.groupName || "MySafeOps"}<small>{state.teams.length + 1}</small></strong>
                    <label><i style={{ background: "#0f766e" }} /><span>{state.calendar.managementCalendar || "Management programme"}</span><input type="checkbox" defaultChecked /></label>
                    {state.calendar.separateTeamCalendars ? state.teams.map((team) => <label key={team.id}><i style={{ background: team.colour }} /><span>{team.name}</span><input type="checkbox" defaultChecked /></label>) : null}
                    {state.calendar.includeCompliance ? <label><i style={{ background: "#c2410c" }} /><span>Compliance deadlines</span><input type="checkbox" defaultChecked /></label> : null}
                  </aside>
                  <div className="mgo-calendar-week">
                    <div className="mgo-calendar-week__days">{["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => <span key={day}><small>{day}</small><b>{addDays(weeks[0].start, index).getDate()}</b></span>)}</div>
                    <div className="mgo-calendar-week__grid">
                      {[0, 1, 2, 3, 4].map((day) => <i key={day} />)}
                      {jobs.slice(0, 3).map((job, index) => {
                        const team = state.teams.find((item) => item.id === job.teamId);
                        return <button type="button" key={job.id} onClick={() => setSelectedJobId(job.id)} style={{ "--event-colour": team?.colour || "#0f766e", gridColumn: `${(index % 3) + 1} / span ${index === 0 ? 2 : 1}`, gridRow: index + 1 }}><strong>{job.name}</strong><small>{team?.name || "Management"} · {readinessForJob(job)}% ready</small></button>;
                      })}
                      {!jobs.length ? <div className="mgo-calendar-week__empty"><CalendarDays size={20} /><span>Scheduled jobs will appear here automatically.</span></div> : null}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mgo-calendar-preview__note"><ShieldCheck size={13} /> The Management programme remains private. Team calendars can be shared separately when you choose.</p>
            </section>

            <aside className="mgo-panel mgo-calendar-settings">
              <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Editable setup</span><h2>Calendar rules</h2></div></div>
              <label>Calendar group name<input value={state.calendar.groupName} onChange={(e) => updateCalendar({ groupName: e.target.value })} /></label>
              <label>Management calendar<input value={state.calendar.managementCalendar} onChange={(e) => updateCalendar({ managementCalendar: e.target.value })} /></label>
              <div className="mgo-calendar-switches">
                <label><span><strong>Separate team calendars</strong><small>One coloured calendar per team</small></span><input type="checkbox" checked={state.calendar.separateTeamCalendars} onChange={(e) => updateCalendar({ separateTeamCalendars: e.target.checked })} /></label>
                <label><span><strong>Show provisional work</strong><small>Ghost jobs appear as tentative</small></span><input type="checkbox" checked={state.calendar.includeProvisional} onChange={(e) => updateCalendar({ includeProvisional: e.target.checked })} /></label>
                <label><span><strong>Document deadlines</strong><small>RAMS, permits and surveys due</small></span><input type="checkbox" checked={state.calendar.includeDeadlines} onChange={(e) => updateCalendar({ includeDeadlines: e.target.checked })} /></label>
                <label><span><strong>Compliance calendar</strong><small>Expiries and outstanding actions</small></span><input type="checkbox" checked={state.calendar.includeCompliance} onChange={(e) => updateCalendar({ includeCompliance: e.target.checked })} /></label>
              </div>
              <button type="button" className="mgo-calendar-download" onClick={exportCalendar}><Download size={16} /><span><strong>Export MySafeOps calendar</strong><small>Works now with Outlook, Google and Apple Calendar</small></span><ChevronRight size={15} /></button>
            </aside>
          </div>
        </div>
      ) : null}

      {tab === "meeting" ? (
        <section className="mgo-meeting">
          <header className="mgo-meeting__hero">
            <div><span className="mgo-eyebrow"><Presentation size={12} /> Private meeting workspace</span><input className="mgo-meeting__title" value={state.meeting.title} onChange={(e) => updateMeeting({ title: e.target.value })} aria-label="Meeting title" /><label>Attendees<input value={state.meeting.attendees} onChange={(e) => updateMeeting({ attendees: e.target.value })} placeholder="e.g. Operations Director, H&S Manager, Contracts Manager" /></label></div>
            <div className="mgo-meeting__hero-actions"><span><i />Live management record</span><button type="button" className="mgo-btn mgo-btn--ghost" onClick={exportBoardPack} disabled={exportBusy}><Download size={14} />Export meeting pack</button></div>
          </header>
          <div className="mgo-meeting__layout">
            <nav className="mgo-meeting__agenda" aria-label="Meeting agenda">
              <span>Meeting agenda</span>
              {meetingAgenda.map((item, index) => <button type="button" key={item.label} className={meetingStep === index ? "is-active" : ""} onClick={() => setMeetingStep(index)}><b>{index + 1}</b><span><strong>{item.label}</strong><small>{item.value}</small></span><ChevronRight size={14} /></button>)}
              <div className="mgo-meeting__progress"><span><i style={{ width: `${((meetingStep + 1) / meetingAgenda.length) * 100}%` }} /></span><small>Agenda {meetingStep + 1} of {meetingAgenda.length}</small></div>
            </nav>
            <div className="mgo-meeting__stage">
              <div className="mgo-meeting__stage-head"><div><span className="mgo-eyebrow">Agenda item {meetingStep + 1}</span><h2>{meetingAgenda[meetingStep].label}</h2><p>{meetingAgenda[meetingStep].detail}</p></div><strong>{meetingAgenda[meetingStep].value}</strong></div>

              {meetingStep === 0 ? <div className="mgo-meeting__brief"><div className="mgo-meeting__big-number"><strong>{attentionJobs.length}</strong><span>jobs require management attention</span></div><div><h3>Today’s operational briefing</h3><p>{gapSuggestion ? `${gapSuggestion.team.name} is ${gapSuggestion.value.percentage}% booked in ${monthLabel.format(gapSuggestion.month)}. ${suggestedOpportunity ? `${suggestedOpportunity.name} is available in the pipeline for review.` : "No matching pipeline opportunity has been added yet."}` : "No immediate capacity exception has been identified."}</p><button type="button" onClick={() => setMeetingStep(4)}>Review decisions <ArrowRight size={14} /></button></div></div> : null}

              {meetingStep === 1 ? <div className="mgo-meeting__job-list">{completedJobs.length ? completedJobs.map((job) => <button type="button" key={job.id} onClick={() => setSelectedJobId(job.id)}><CheckCircle2 size={17} /><span><strong>{job.name}</strong><small>{job.client} · completed {dateLabel(job.end)}</small></span><ChevronRight size={14} /></button>) : <div className="mgo-empty"><CheckCircle2 size={25} /><strong>No completed work recorded</strong><span>Mark completed jobs to include them in the four-week review.</span></div>}</div> : null}

              {meetingStep === 2 ? <div className="mgo-meeting__job-list">{scheduledJobs.slice(0, 12).map((job) => <button type="button" key={job.id} onClick={() => setSelectedJobId(job.id)}><span className={`mgo-meeting__dot mgo-meeting__dot--${jobTone(job)}`} /><span><strong>{job.name}</strong><small>{state.teams.find((team) => team.id === job.teamId)?.name || "Unassigned"} · {dateLabel(job.start)} to {dateLabel(job.end)}</small></span><ReadinessRing value={readinessForJob(job)} size="small" /></button>)}{!scheduledJobs.length ? <div className="mgo-empty"><CalendarDays size={25} /><strong>No upcoming work</strong><span>Add project dates to populate this agenda item.</span></div> : null}</div> : null}

              {meetingStep === 3 ? <div className="mgo-meeting__capacity">{capacityRows.map(({ team, values }) => <article key={team.id}><header><i style={{ background: team.colour }} /><strong>{team.name}</strong><small>{team.region || "No region"}</small></header>{values.map((value, index) => <div key={index}><span>{shortMonthLabel.format(capacityMonths[index])}<b className={value.percentage > 100 ? "is-over" : value.percentage < 60 ? "is-gap" : ""}>{value.percentage}%</b></span><em><i style={{ width: `${Math.min(100, value.percentage)}%` }} /></em></div>)}</article>)}</div> : null}

              {meetingStep === 4 ? <div className="mgo-meeting__job-list">{attentionJobs.slice(0, 12).map((job) => <button type="button" key={job.id} onClick={() => setSelectedJobId(job.id)}><AlertTriangle size={17} /><span><strong>{job.name}</strong><small>{job.teamId ? state.teams.find((team) => team.id === job.teamId)?.name : "No team assigned"} · {readinessForJob(job)}% ready</small></span><span className={`mgo-status mgo-status--${jobTone(job)}`}>{job.status}</span></button>)}{!attentionJobs.length ? <div className="mgo-empty"><CheckCircle2 size={25} /><strong>No decisions required</strong><span>All active jobs are currently ready.</span></div> : null}</div> : null}

              {meetingStep === 5 ? <div className="mgo-actions"><form onSubmit={addMeetingAction}><label>Decision or action<input autoFocus value={newAction.text} onChange={(e) => setNewAction((action) => ({ ...action, text: e.target.value }))} placeholder="e.g. Confirm North Team for Manchester" required /></label><label>Owner<input value={newAction.owner} onChange={(e) => setNewAction((action) => ({ ...action, owner: e.target.value }))} placeholder="Name" /></label><label>Due date<input type="date" value={newAction.due} onChange={(e) => setNewAction((action) => ({ ...action, due: e.target.value }))} /></label><button className="mgo-btn mgo-btn--primary"><Plus size={14} />Add action</button></form><div className="mgo-actions__list">{state.meeting.actions.map((action) => <article key={action.id} className={action.status === "Done" ? "is-done" : ""}><button type="button" aria-label={action.status === "Done" ? "Reopen action" : "Complete action"} onClick={() => updateMeetingAction(action.id, { status: action.status === "Done" ? "Open" : "Done" })}><CheckCircle2 size={17} /></button><span><strong>{action.text}</strong><small>{action.owner || "Unassigned"} · due {dateLabel(action.due)}</small></span><select value={action.status} onChange={(e) => updateMeetingAction(action.id, { status: e.target.value })}><option>Open</option><option>In progress</option><option>Done</option></select><button type="button" aria-label="Remove action" onClick={() => removeMeetingAction(action.id)}><Trash2 size={14} /></button></article>)}{!state.meeting.actions.length ? <div className="mgo-empty"><ListTodo size={25} /><strong>No actions recorded</strong><span>Add decisions during the meeting. They will appear in the Board Pack.</span></div> : null}</div></div> : null}

              <label className="mgo-meeting__notes">Management notes<textarea value={state.meeting.notes} onChange={(e) => updateMeeting({ notes: e.target.value })} placeholder="Record context, decisions and follow-up notes for the Board Pack..." /></label>
              <footer className="mgo-meeting__stage-nav"><button type="button" disabled={meetingStep === 0} onClick={() => setMeetingStep((step) => Math.max(0, step - 1))}>Previous</button><span>Changes save automatically</span><button type="button" disabled={meetingStep === meetingAgenda.length - 1} onClick={() => setMeetingStep((step) => Math.min(meetingAgenda.length - 1, step + 1))}>Next agenda item <ChevronRight size={13} /></button></footer>
            </div>
          </div>
        </section>
      ) : null}

      {selectedJob ? (
        <div className="mgo-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedJobId(null); }}>
          <aside className="mgo-drawer" role="dialog" aria-modal="true" aria-labelledby="mgo-job-title">
            <button type="button" className="mgo-drawer__close" onClick={() => setSelectedJobId(null)} aria-label="Close job editor"><X size={18} /></button>
            <span className="mgo-eyebrow">{selectedJob.source === "opportunity" ? "Pipeline opportunity" : "Scheduled project"}</span>
            <h2 id="mgo-job-title">{selectedJob.name}</h2>
            <p>{selectedJob.client} · {selectedJob.site}</p>
            <div className="mgo-drawer__score"><ReadinessRing value={readinessForJob(selectedJob)} /><div><strong>Job readiness</strong><span>Update each requirement as the job becomes ready.</span></div></div>
            <div className="mgo-drawer__grid"><label>Start date<input type="date" value={selectedJob.start || ""} onChange={(e) => updateJob(selectedJob.id, { start: e.target.value, readiness: { ...selectedJob.readiness, dates: Boolean(e.target.value && selectedJob.end) } })} /></label><label>Finish date<input type="date" value={selectedJob.end || ""} onChange={(e) => updateJob(selectedJob.id, { end: e.target.value, readiness: { ...selectedJob.readiness, dates: Boolean(selectedJob.start && e.target.value) } })} /></label><label>Assigned team<select value={selectedJob.teamId || ""} onChange={(e) => updateJob(selectedJob.id, { teamId: e.target.value, readiness: { ...selectedJob.readiness, team: Boolean(e.target.value) } })}><option value="">Unassigned</option>{state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Status<select value={selectedJob.status} onChange={(e) => updateJob(selectedJob.id, { status: e.target.value })}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label></div>
            <fieldset className="mgo-checklist"><legend>Readiness checklist</legend>{READINESS_FIELDS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(selectedJob.readiness[key])} onChange={(e) => updateJob(selectedJob.id, { readiness: { ...selectedJob.readiness, [key]: e.target.checked } })} /><span>{label}</span>{selectedJob.source === "project" && ["rams", "permits", "survey"].includes(key) ? <small>{selectedJob.documentCounts[`${key === "survey" ? "surveys" : key}`]} linked</small> : null}</label>)}</fieldset>
            {selectedJob.source === "opportunity" ? <button type="button" className="mgo-btn mgo-btn--danger" onClick={() => removeOpportunity(selectedJob.id)}><Trash2 size={14} /> Remove opportunity</button> : null}
            <div className="mgo-drawer__saved"><CheckCircle2 size={14} /> Changes save automatically</div>
          </aside>
        </div>
      ) : null}

      {calendarSetupProvider ? (
        <div className="mgo-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCalendarSetupProvider(""); }}>
          <aside className="mgo-calendar-setup" role="dialog" aria-modal="true" aria-labelledby="mgo-calendar-setup-title">
            <button type="button" className="mgo-drawer__close" onClick={() => setCalendarSetupProvider("")} aria-label="Close calendar connection setup"><X size={18} /></button>
            <span className={`mgo-calendar-setup__provider mgo-calendar-setup__provider--${calendarSetupProvider}`}>{calendarSetupProvider === "microsoft" ? "Microsoft 365" : "Google Workspace"}</span>
            <h2 id="mgo-calendar-setup-title">Secure calendar connection</h2>
            <p>The visual Calendar Hub is ready. Live two-way sync needs the organisation’s calendar app connection to be configured before managers can authorise access.</p>
            <ol><li><span><ShieldCheck size={15} /></span><div><strong>Management authorises access</strong><small>MySafeOps requests calendar-only permissions.</small></div></li><li><span><Layers3 size={15} /></span><div><strong>MySafeOps calendars are created</strong><small>Management, teams and compliance stay separated.</small></div></li><li><span><RefreshCw size={15} /></span><div><strong>Changes sync automatically</strong><small>Reschedules and cancellations update the same event.</small></div></li></ol>
            <div className="mgo-calendar-setup__notice"><LockKeyhole size={15} /><span><strong>No connection has been made yet.</strong> Provider credentials and the secure callback must be added server-side.</span></div>
            <button type="button" className="mgo-btn mgo-btn--primary" onClick={() => setCalendarSetupProvider("")}>Keep this ready for connection</button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
