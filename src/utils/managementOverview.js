import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

export const MANAGEMENT_OVERVIEW_KEY = "management_overview_v1";

const TEAM_COLOURS = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c", "#0369a1"];

/** Statuses a job may hold. Anything else in the shared document is coerced back to provisional. */
export const JOB_STATUSES = ["provisional", "confirmed", "blocked", "delayed", "completed", "cancelled"];
export const ACTION_STATUSES = ["Open", "In progress", "Done"];
export const READINESS_KEYS = ["dates", "team", "rams", "permits", "survey", "client"];

/** Control characters are never valid in a job name and are dangerous inside an ICS line. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point: they are stripped.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const MAX_JOB_CONFIGS = 1000;

/**
 * Trim, strip control characters and cap a string coming from the shared workspace
 * document. That document is writable by every manager in the organisation and is
 * replayed into the UI, the ICS export and the Board Pack PDF, so nothing unbounded
 * or unprintable is allowed through.
 */
export function cleanText(value, max = 200) {
  return String(value ?? "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}

/** Accept only a real calendar date in ISO form; everything else becomes "". */
export function cleanIsoDate(value) {
  const text = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = dateOnly(text);
  return parsed && isoDate(parsed) === text ? text : "";
}

/** Contract values are money: finite, never negative, capped and rounded to the penny. */
export function cleanMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(Math.min(amount, 1_000_000_000) * 100) / 100;
}

export const DEFAULT_MANAGEMENT_TEAMS = [
  { id: "team_north", name: "North Team", colour: TEAM_COLOURS[0], capacity: 5, region: "North" },
  { id: "team_central", name: "Central Team", colour: TEAM_COLOURS[1], capacity: 5, region: "Midlands" },
  { id: "team_south", name: "South Team", colour: TEAM_COLOURS[2], capacity: 5, region: "South" },
];

export const EMPTY_MANAGEMENT_STATE = {
  teams: DEFAULT_MANAGEMENT_TEAMS,
  jobs: {},
  opportunities: [],
  calendar: {
    groupName: "MySafeOps",
    managementCalendar: "Management programme",
    separateTeamCalendars: true,
    includeProvisional: true,
    includeDeadlines: true,
    includeCompliance: true,
    connectedProvider: "",
  },
  meeting: {
    title: "Weekly management meeting",
    attendees: "",
    notes: "",
    actions: [],
  },
  // Closed meetings, newest first. Without this each meeting overwrote the last one.
  meetings: [],
  /** Who moved what, newest first — a shared plan needs to say who changed it. */
  history: [],
};

export const MAX_ARCHIVED_MEETINGS = 24;
export const MAX_HISTORY_ENTRIES = 300;

/**
 * Fields worth a history entry. Readiness checkboxes are deliberately excluded: six booleans
 * per job would bury the changes that actually move work — dates, crew, status and value.
 */
export const TRACKED_JOB_FIELDS = ["start", "end", "teamId", "status", "value"];

/**
 * What changed between a job and a patch about to be applied to it.
 *
 * @param {object} job
 * @param {object} patch
 * @returns {{field: string, from: string|number, to: string|number}[]}
 */
export function diffJobChanges(job, patch) {
  if (!job || !patch || typeof patch !== "object") return [];
  const changes = [];
  for (const field of TRACKED_JOB_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const from = field === "value" ? cleanMoney(job[field]) : job[field] ?? "";
    const to = field === "value" ? cleanMoney(patch[field]) : patch[field] ?? "";
    if (String(from) === String(to)) continue;
    changes.push({ field, from, to });
  }
  return changes;
}

function validTeam(team, index) {
  return {
    id: cleanText(team?.id, 60) || `team_${index + 1}`,
    name: cleanText(team?.name, 60) || `Team ${index + 1}`,
    colour: /^#[0-9a-f]{6}$/i.test(team?.colour || "") ? team.colour : TEAM_COLOURS[index % TEAM_COLOURS.length],
    capacity: Math.max(1, Math.min(7, Number(team?.capacity) || 5)),
    region: cleanText(team?.region, 60),
    // Crew roster: ids into the workers register, so a team is people rather than a colour.
    memberIds: Array.isArray(team?.memberIds)
      ? [...new Set(team.memberIds.slice(0, 60).map((memberId) => cleanText(memberId, 80)).filter(Boolean))]
      : [],
    daysOff: Array.isArray(team?.daysOff) ? team.daysOff.slice(0, 60).map(validDaysOff).filter((row) => row.from) : [],
    worksPublicHolidays: Boolean(team?.worksPublicHolidays),
  };
}

/** Shutdowns, leave and public holidays — days the team cannot be booked. */
function validDaysOff(raw, index) {
  const from = cleanIsoDate(raw?.from);
  const to = cleanIsoDate(raw?.to) || from;
  return {
    id: cleanText(raw?.id, 80) || `off_${index + 1}`,
    label: cleanText(raw?.label, 60),
    from,
    to: to && from && to < from ? from : to,
  };
}

function validReadiness(raw) {
  if (!raw || typeof raw !== "object") return null;
  return Object.fromEntries(READINESS_KEYS.map((key) => [key, Boolean(raw[key])]));
}

/**
 * Per-project overrides. `readiness` stays absent when the document never stored one, so
 * the module can keep deriving it from the linked RAMS, permits and surveys.
 */
function validJobConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const config = {
    start: cleanIsoDate(raw.start),
    end: cleanIsoDate(raw.end),
    teamId: cleanText(raw.teamId, 60),
    status: JOB_STATUSES.includes(raw.status) ? raw.status : "provisional",
    value: cleanMoney(raw.value),
  };
  const readiness = validReadiness(raw.readiness);
  if (readiness) config.readiness = readiness;
  return config;
}

function validJobsMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = [];
  for (const [key, value] of Object.entries(raw)) {
    if (entries.length >= MAX_JOB_CONFIGS) break;
    const id = cleanText(key, 120);
    const config = validJobConfig(value);
    if (id && config) entries.push([id, config]);
  }
  return Object.fromEntries(entries);
}

function validOpportunity(raw, index) {
  const start = cleanIsoDate(raw?.start);
  const end = cleanIsoDate(raw?.end) || start;
  const teamId = cleanText(raw?.teamId, 60);
  return {
    id: cleanText(raw?.id, 80) || `opportunity_${index + 1}`,
    name: cleanText(raw?.name, 120) || `Opportunity ${index + 1}`,
    client: cleanText(raw?.client, 120),
    site: cleanText(raw?.site, 160),
    start,
    end: end && start && end < start ? start : end,
    teamId,
    status: JOB_STATUSES.includes(raw?.status) ? raw.status : "provisional",
    value: cleanMoney(raw?.value),
    readiness:
      validReadiness(raw?.readiness)
      || { dates: Boolean(start), team: Boolean(teamId), rams: false, permits: false, survey: false, client: false },
  };
}

function validAction(raw, index) {
  return {
    id: cleanText(raw?.id, 80) || `action_${index + 1}`,
    text: cleanText(raw?.text, 300),
    owner: cleanText(raw?.owner, 80),
    due: cleanIsoDate(raw?.due),
    status: ACTION_STATUSES.includes(raw?.status) ? raw.status : "Open",
  };
}

/** ISO timestamp, or "" — history entries are ordered by it, so a bad one must not sort. */
function cleanIsoTimestamp(value) {
  const text = String(value ?? "").slice(0, 24);
  const parsed = new Date(text);
  return text && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "";
}

function validHistoryEntry(raw, index) {
  return {
    id: cleanText(raw?.id, 80) || `change_${index + 1}`,
    jobId: cleanText(raw?.jobId, 120),
    jobName: cleanText(raw?.jobName, 120),
    field: TRACKED_JOB_FIELDS.includes(raw?.field) ? raw.field : "",
    from: cleanText(raw?.from, 60),
    to: cleanText(raw?.to, 60),
    at: cleanIsoTimestamp(raw?.at),
    by: cleanText(raw?.by, 80),
    byUserId: cleanText(raw?.byUserId, 80),
  };
}

function validArchivedMeeting(raw, index) {
  return {
    id: cleanText(raw?.id, 80) || `meeting_${index + 1}`,
    title: cleanText(raw?.title, 100) || "Management meeting",
    closedOn: cleanIsoDate(raw?.closedOn),
    attendees: cleanText(raw?.attendees, 500),
    notes: String(raw?.notes || "").slice(0, 5000),
    actions: Array.isArray(raw?.actions) ? raw.actions.slice(0, 200).map(validAction).filter((action) => action.text) : [],
  };
}

export function normaliseManagementState(raw) {
  const teams = Array.isArray(raw?.teams) && raw.teams.length
    ? raw.teams.slice(0, 30).map(validTeam)
    : DEFAULT_MANAGEMENT_TEAMS.map((team) => ({ ...team }));
  return {
    teams,
    jobs: validJobsMap(raw?.jobs),
    opportunities: Array.isArray(raw?.opportunities) ? raw.opportunities.slice(0, 100).map(validOpportunity) : [],
    calendar: {
      ...EMPTY_MANAGEMENT_STATE.calendar,
      ...(raw?.calendar && typeof raw.calendar === "object" ? raw.calendar : {}),
      groupName: cleanText(raw?.calendar?.groupName, 60) || EMPTY_MANAGEMENT_STATE.calendar.groupName,
      managementCalendar:
        cleanText(raw?.calendar?.managementCalendar, 60) || EMPTY_MANAGEMENT_STATE.calendar.managementCalendar,
      separateTeamCalendars: Boolean(raw?.calendar?.separateTeamCalendars ?? true),
      includeProvisional: Boolean(raw?.calendar?.includeProvisional ?? true),
      includeDeadlines: Boolean(raw?.calendar?.includeDeadlines ?? true),
      includeCompliance: Boolean(raw?.calendar?.includeCompliance ?? true),
      connectedProvider: ["google", "microsoft"].includes(raw?.calendar?.connectedProvider)
        ? raw.calendar.connectedProvider
        : "",
    },
    meeting: {
      ...EMPTY_MANAGEMENT_STATE.meeting,
      ...(raw?.meeting && typeof raw.meeting === "object" ? raw.meeting : {}),
      title: cleanText(raw?.meeting?.title, 100) || EMPTY_MANAGEMENT_STATE.meeting.title,
      attendees: cleanText(raw?.meeting?.attendees, 500),
      notes: String(raw?.meeting?.notes || "").slice(0, 5000),
      actions: Array.isArray(raw?.meeting?.actions)
        ? raw.meeting.actions.slice(0, 200).map(validAction).filter((action) => action.text)
        : [],
    },
    meetings: Array.isArray(raw?.meetings)
      ? raw.meetings.slice(0, MAX_ARCHIVED_MEETINGS).map(validArchivedMeeting)
      : [],
    history: Array.isArray(raw?.history)
      ? raw.history.slice(0, MAX_HISTORY_ENTRIES).map(validHistoryEntry).filter((entry) => entry.field && entry.jobId)
      : [],
  };
}

export function loadManagementState() {
  return normaliseManagementState(loadOrgScoped(MANAGEMENT_OVERVIEW_KEY, null));
}

export function saveManagementState(state) {
  return saveOrgScoped(MANAGEMENT_OVERVIEW_KEY, normaliseManagementState(state));
}

function mergeRowsById(remoteRows, localRows, limit) {
  const rows = new Map();
  for (const row of Array.isArray(remoteRows) ? remoteRows : []) {
    if (row?.id) rows.set(row.id, row);
  }
  for (const row of Array.isArray(localRows) ? localRows : []) {
    if (row?.id) rows.set(row.id, { ...(rows.get(row.id) || {}), ...row });
  }
  return [...rows.values()].slice(0, limit);
}

/** Merge a concurrently received cloud snapshot with unsaved local management edits. */
export function mergeManagementStates(remoteState, localState) {
  const remote = normaliseManagementState(remoteState);
  const local = normaliseManagementState(localState);
  return normaliseManagementState({
    ...remote,
    ...local,
    teams: mergeRowsById(remote.teams, local.teams, 30),
    jobs: { ...remote.jobs, ...local.jobs },
    opportunities: mergeRowsById(remote.opportunities, local.opportunities, 100),
    calendar: { ...remote.calendar, ...local.calendar },
    meeting: {
      ...remote.meeting,
      ...local.meeting,
      actions: mergeRowsById(remote.meeting.actions, local.meeting.actions, 200),
    },
    meetings: mergeRowsById(remote.meetings, local.meetings, MAX_ARCHIVED_MEETINGS),
    // Two managers editing at once each hold half the story; keep both, newest first.
    history: mergeRowsById(remote.history, local.history, MAX_HISTORY_ENTRIES)
      .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
      .slice(0, MAX_HISTORY_ENTRIES),
  });
}

/**
 * Roll several countries' management documents into one read-only view.
 *
 * Only what the document itself owns can be consolidated: teams, pipeline
 * opportunities and meeting actions. Scheduled jobs are deliberately excluded —
 * they are derived from each country's project register, which is isolated per
 * country on both the device and the server, so a cross-country job roll-up would
 * require reading data the viewer is not entitled to.
 *
 * @param {{workspaceId: string, countryName: string, marketId?: string, state: object}[]} entries
 */
export function consolidateManagementStates(entries) {
  const rows = Array.isArray(entries) ? entries.filter((entry) => entry?.workspaceId) : [];
  const countries = [];
  const teams = [];
  const opportunities = [];
  const actions = [];

  for (const entry of rows) {
    const state = normaliseManagementState(entry.state);
    const country = {
      workspaceId: entry.workspaceId,
      countryName: cleanText(entry.countryName, 60),
      marketId: entry.marketId || "",
      teams: state.teams.length,
      opportunities: state.opportunities.length,
      openActions: state.meeting.actions.filter((action) => action?.status !== "Done").length,
      capacity: state.teams.reduce((total, team) => total + (Number(team.capacity) || 0), 0),
    };
    countries.push(country);

    const tag = (row, index) => ({
      ...row,
      id: `${entry.workspaceId}:${row?.id || index}`,
      countryName: country.countryName,
      marketId: country.marketId,
      workspaceId: entry.workspaceId,
    });
    state.teams.forEach((team, index) => teams.push(tag(team, index)));
    state.opportunities.forEach((opportunity, index) => opportunities.push(tag(opportunity, index)));
    state.meeting.actions.forEach((action, index) => actions.push(tag(action, index)));
  }

  return {
    countries,
    teams,
    opportunities,
    actions,
    totals: {
      countries: countries.length,
      teams: teams.length,
      opportunities: opportunities.length,
      openActions: actions.filter((action) => action?.status !== "Done").length,
      capacity: countries.reduce((total, country) => total + country.capacity, 0),
    },
  };
}

export function dateOnly(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

/** Whole days between two dates, positive when `to` is later. Null when either is unusable. */
export function daysBetween(from, to) {
  const start = dateOnly(from instanceof Date ? isoDate(from) : from);
  const end = dateOnly(to instanceof Date ? isoDate(to) : to);
  if (!start || !end) return null;
  return Math.round((end - start) / 86400000);
}

export function mondayOf(date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day + (day === 0 ? -6 : 1));
  next.setHours(12, 0, 0, 0);
  return next;
}

export function buildPlannerWeeks(anchor = new Date(), count = 13) {
  const first = mondayOf(anchor);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(first, index * 7);
    return { index, start, end: addDays(start, 6), iso: isoDate(start) };
  });
}

export function workingDaysBetween(startValue, endValue) {
  const start = dateOnly(startValue);
  const end = dateOnly(endValue);
  if (!start || !end || end < start) return 0;
  let total = 0;
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    if (day.getDay() !== 0 && day.getDay() !== 6) total += 1;
  }
  return total;
}

export function plannerPosition(startValue, endValue, weeks) {
  const start = dateOnly(startValue);
  const end = dateOnly(endValue) || start;
  if (!start || !weeks?.length) return null;
  const rangeStart = weeks[0].start;
  const rangeEnd = weeks[weeks.length - 1].end;
  if (end < rangeStart || start > rangeEnd) return null;
  const visibleStart = start < rangeStart ? rangeStart : start;
  const visibleEnd = end > rangeEnd ? rangeEnd : end;
  const dayMs = 24 * 60 * 60 * 1000;
  const startDays = Math.floor((visibleStart - rangeStart) / dayMs);
  const endDays = Math.floor((visibleEnd - rangeStart) / dayMs);
  return {
    left: (startDays / (weeks.length * 7)) * 100,
    width: Math.max(1.2, ((endDays - startDays + 1) / (weeks.length * 7)) * 100),
  };
}

/**
 * Move a job by a whole number of days, keeping its duration.
 *
 * @returns {{start: string, end: string}|null} null when the job has no usable start or the
 * shift is a no-op, so callers can skip writing an identical state back.
 */
export function shiftJobDates(job, days) {
  const start = dateOnly(job?.start);
  const offset = Math.trunc(Number(days) || 0);
  if (!start || !offset) return null;
  const end = dateOnly(job?.end) || start;
  return { start: isoDate(addDays(start, offset)), end: isoDate(addDays(end, offset)) };
}

/** Pixels dragged across the planner track, converted to whole days. */
export function plannerDaysFromDelta(deltaPx, trackWidthPx, weekCount) {
  const width = Number(trackWidthPx);
  const weeks = Number(weekCount);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(weeks) || weeks <= 0) return 0;
  return Math.round((Number(deltaPx) || 0) / (width / (weeks * 7)));
}

/**
 * Keep a dragged job inside the visible window: a bar dropped off the edge would simply
 * vanish from the planner with no way back.
 */
export function clampPlannerShift(job, days, weeks) {
  const start = dateOnly(job?.start);
  if (!start || !weeks?.length) return 0;
  const first = weeks[0].start;
  const last = weeks[weeks.length - 1].end;
  const minDays = Math.ceil((first - start) / 86400000);
  const maxDays = Math.floor((last - start) / 86400000);
  return Math.max(minDays, Math.min(maxDays, Math.trunc(Number(days) || 0)));
}

/** Percentage across the planner width where "today" sits, or null when off-window. */
export function plannerTodayOffset(weeks, anchor = new Date()) {
  const today = dateOnly(anchor instanceof Date ? isoDate(anchor) : anchor);
  if (!today || !weeks?.length) return null;
  const days = Math.floor((today - weeks[0].start) / 86400000);
  const span = weeks.length * 7;
  if (days < 0 || days >= span) return null;
  return ((days + 0.5) / span) * 100;
}

export function readinessForJob(job) {
  const checks = job?.readiness || {};
  const values = READINESS_KEYS.map((key) => Boolean(checks[key]));
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

export function jobTone(job) {
  if (job?.status === "cancelled" || job?.status === "delayed" || job?.status === "blocked") return "red";
  if (job?.status === "completed") return "green";
  const readiness = readinessForJob(job);
  if (job?.status === "confirmed" && readiness === 100) return "green";
  return readiness < 50 ? "red" : "amber";
}

/**
 * Where a job sits against today. The 90-day window only holds future starts, so without
 * this, work that is running now — or that has run past its finish date — is invisible.
 *
 * @returns {"cancelled"|"done"|"unscheduled"|"overdue"|"active"|"upcoming"}
 */
export function jobSchedulePhase(job, anchor = new Date()) {
  if (job?.status === "cancelled") return "cancelled";
  if (job?.status === "completed") return "done";
  const today = dateOnly(anchor instanceof Date ? isoDate(anchor) : anchor);
  const start = dateOnly(job?.start);
  const end = dateOnly(job?.end) || start;
  if (!today || !start || !end) return "unscheduled";
  if (end < today) return "overdue";
  if (start <= today) return "active";
  return "upcoming";
}

export function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  const aStart = dateOnly(firstStart);
  const aEnd = dateOnly(firstEnd || firstStart);
  const bStart = dateOnly(secondStart);
  const bEnd = dateOnly(secondEnd || secondStart);
  return Boolean(aStart && aEnd && bStart && bEnd && aStart <= bEnd && bStart <= aEnd);
}

/**
 * Double bookings on the live programme: two active jobs sharing a team and overlapping in
 * time. Sorted sweep with an early break rather than a full pairwise scan, so a large
 * register stays cheap.
 *
 * @param {object[]} jobs
 * @param {{id: string, name?: string}[]} [teams]
 */
export function findScheduleConflicts(jobs = [], teams = []) {
  const teamList = Array.isArray(teams) ? teams : [];
  const teamName = (teamId) => teamList.find((team) => team?.id === teamId)?.name || "Unassigned team";
  const byTeam = new Map();
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!job?.teamId || job.status === "cancelled" || job.status === "completed") continue;
    if (!dateOnly(job.start)) continue;
    if (!byTeam.has(job.teamId)) byTeam.set(job.teamId, []);
    byTeam.get(job.teamId).push(job);
  }

  const conflicts = [];
  for (const [teamId, teamJobs] of byTeam) {
    const sorted = [...teamJobs].sort((a, b) => String(a.start).localeCompare(String(b.start)));
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      const currentEnd = dateOnly(current.end) || dateOnly(current.start);
      for (let next = index + 1; next < sorted.length; next += 1) {
        const other = sorted[next];
        const otherStart = dateOnly(other.start);
        // Sorted by start: once a later job begins after this one ends, nothing else can clash.
        if (otherStart > currentEnd) break;
        const otherEnd = dateOnly(other.end) || otherStart;
        const to = currentEnd < otherEnd ? currentEnd : otherEnd;
        conflicts.push({
          id: `${current.id}__${other.id}`,
          teamId,
          teamName: teamName(teamId),
          jobs: [current, other],
          from: isoDate(otherStart),
          to: isoDate(to),
          days: workingDaysBetween(isoDate(otherStart), isoDate(to)),
        });
      }
    }
  }
  return conflicts.sort((a, b) => a.from.localeCompare(b.from));
}

/** Ids of every job caught in at least one conflict — used to badge planner rows. */
export function conflictJobIds(conflicts = []) {
  const ids = new Set();
  for (const conflict of Array.isArray(conflicts) ? conflicts : []) {
    for (const job of conflict?.jobs || []) {
      if (job?.id) ids.add(job.id);
    }
  }
  return ids;
}

export const MOBILISATION_HORIZON_DAYS = 14;

/**
 * @param {string} ramsLabel Market term for the method statement: RAMS (UK), SWMS (AU), IOR (PL).
 */
function mobilisationChecks(ramsLabel = "RAMS") {
  return [
    ["team", "Team"],
    ["rams", ramsLabel],
    ["permits", "Permits"],
    ["survey", "Survey"],
    ["client", "Client sign-off"],
  ];
}

/**
 * The jobs about to mobilise and what is still missing on them.
 *
 * The readiness heatmap answers "is this job ready"; this answers the question management
 * actually asks on a Monday — "what leaves the yard this fortnight, and what will stop it".
 *
 * @param {object[]} jobs
 * @param {object} [options]
 * @param {Date|string} [options.today]
 * @param {number} [options.horizonDays]
 * @param {Map<string, {count: number}>} [options.crewByTeam] Crew roster per team id.
 * @param {string} [options.ramsLabel] Market term for the method statement.
 */
export function buildMobilisationWatch(jobs = [], { today = new Date(), horizonDays = MOBILISATION_HORIZON_DAYS, crewByTeam, ramsLabel } = {}) {
  const anchor = dateOnly(today instanceof Date ? isoDate(today) : today);
  if (!anchor) return [];

  const checks = mobilisationChecks(ramsLabel);
  const rows = [];
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const phase = jobSchedulePhase(job, anchor);
    if (phase !== "upcoming" && phase !== "active") continue;
    const daysToStart = daysBetween(anchor, dateOnly(job.start));
    if (daysToStart === null || daysToStart > horizonDays) continue;

    const missing = checks.filter(([key]) => !job.readiness?.[key]).map(([, label]) => label);
    // A team can be named on the job and still have nobody rostered to it.
    const crewMissing = Boolean(job.teamId) && crewByTeam ? (crewByTeam.get(job.teamId)?.count || 0) === 0 : false;
    const issues = crewMissing ? [...missing, "Crew"] : missing;
    rows.push({
      job,
      phase,
      daysToStart,
      missing,
      crewMissing,
      issues,
      severity: !issues.length ? "ready" : daysToStart <= 3 ? "critical" : "warning",
    });
  }

  const rank = { critical: 0, warning: 1, ready: 2 };
  return rows.sort((a, b) => rank[a.severity] - rank[b.severity] || a.daysToStart - b.daysToStart);
}

/**
 * Contract value across a set of jobs. Values live on the management document, so a project
 * without one simply contributes nothing rather than breaking the total.
 */
export function sumJobValue(jobs = []) {
  return (Array.isArray(jobs) ? jobs : []).reduce((total, job) => total + cleanMoney(job?.value), 0);
}

/**
 * Working days a team loses inside one month, to its own leave and shutdowns and to public
 * holidays. Collected as a set of dates rather than counted per source, so a shutdown booked
 * across Christmas is not subtracted twice.
 *
 * @param {object} team
 * @param {Date} monthStart
 * @param {Date} monthEnd
 * @param {string[]} [holidayDates] ISO dates the market treats as public holidays.
 */
export function daysOffInMonth(team, monthStart, monthEnd, holidayDates = []) {
  const lost = new Set();
  const addRange = (fromValue, toValue) => {
    const from = dateOnly(fromValue);
    if (!from) return;
    const to = dateOnly(toValue) || from;
    if (to < monthStart || from > monthEnd) return;
    const first = from < monthStart ? monthStart : from;
    const last = to > monthEnd ? monthEnd : to;
    for (let day = new Date(first); day <= last; day = addDays(day, 1)) {
      if (day.getDay() !== 0 && day.getDay() !== 6) lost.add(isoDate(day));
    }
  };

  for (const row of Array.isArray(team?.daysOff) ? team.daysOff : []) addRange(row?.from, row?.to);
  // A crew that genuinely works bank holidays keeps them as available days.
  if (!team?.worksPublicHolidays) {
    for (const date of Array.isArray(holidayDates) ? holidayDates : []) addRange(date, date);
  }
  return lost.size;
}

export function monthCapacity(jobs, team, monthDate, holidayDates = []) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12);
  const workingDaysPerWeek = Math.max(1, Math.min(7, Number(team?.capacity) || 5));
  const grossWorkingDays = Math.round(workingDaysBetween(isoDate(start), isoDate(end)) * (workingDaysPerWeek / 5));
  // Leave, shutdowns and public holidays come off the top: a month with a week booked out
  // and two bank holidays is not a full month.
  const lostDays = Math.min(grossWorkingDays, daysOffInMonth(team, start, end, holidayDates));
  const totalWorkingDays = grossWorkingDays - lostDays;
  const booked = jobs
    .filter((job) => job.teamId === team.id && job.status !== "cancelled")
    .reduce((sum, job) => {
      const jobStart = dateOnly(job.start);
      const jobEnd = dateOnly(job.end);
      if (!jobStart || !jobEnd || jobEnd < start || jobStart > end) return sum;
      return sum + workingDaysBetween(isoDate(jobStart < start ? start : jobStart), isoDate(jobEnd > end ? end : jobEnd));
    }, 0);
  const percentage = totalWorkingDays ? Math.round((booked / totalWorkingDays) * 100) : 0;
  return { booked, total: totalWorkingDays, percentage, lostDays };
}

/**
 * Diary roll-up for management: what is running now, the next 90 days, the last 28 days
 * completed, work that has run past its finish date, and capacity gaps.
 *
 * @param {object[]} jobs
 * @param {{ id: string, name: string, capacity?: number }[]} teams
 * @param {Date|string} [anchor]
 * @param {string[]} [holidayDates] Public holidays, so gap detection matches the forecast.
 */
export function buildManagementDiary(jobs = [], teams = [], anchor = new Date(), holidayDates = []) {
  const today = dateOnly(isoDate(anchor)) || dateOnly(isoDate(new Date()));
  const inNinetyDays = addDays(today, 90);
  const fourWeeksAgo = addDays(today, -28);
  const list = Array.isArray(jobs) ? jobs : [];
  const byStart = (a, b) => String(a.start || "").localeCompare(String(b.start || ""));
  const phase = (job) => jobSchedulePhase(job, today);

  const scheduled = list
    .filter((job) => {
      const start = dateOnly(job.start);
      return start && start >= today && start <= inNinetyDays && job.status !== "cancelled";
    })
    .sort(byStart);

  // Started but not finished. Invisible to the 90-day window, yet it is today's work.
  const inProgress = list.filter((job) => phase(job) === "active").sort(byStart);

  // Planned finish has passed and nobody marked the job complete.
  const overdue = list
    .filter((job) => phase(job) === "overdue")
    .sort((a, b) => String(a.end || a.start || "").localeCompare(String(b.end || b.start || "")));

  const completed = list
    .filter((job) => {
      const end = dateOnly(job.end);
      return job.status === "completed" && end && end >= fourWeeksAgo && end <= today;
    })
    .sort((a, b) => String(b.end || "").localeCompare(String(a.end || "")));

  const capacityMonths = [];
  for (let offset = 0; offset < 3; offset += 1) {
    capacityMonths.push(new Date(today.getFullYear(), today.getMonth() + offset, 1, 12));
  }

  const gapSlots = (Array.isArray(teams) ? teams : []).flatMap((team) =>
    capacityMonths.map((month) => {
      const value = monthCapacity(list, team, month, holidayDates);
      return {
        teamId: team.id,
        teamName: team.name,
        month,
        monthKey: isoDate(month).slice(0, 7),
        ...value,
        isGap: value.percentage < 60,
        isOver: value.percentage > 100,
      };
    }),
  );

  const gaps = gapSlots.filter((slot) => slot.isGap).sort((a, b) => a.percentage - b.percentage);
  const overbooked = gapSlots.filter((slot) => slot.isOver).sort((a, b) => b.percentage - a.percentage);

  return {
    today,
    inNinetyDays,
    fourWeeksAgo,
    capacityMonths,
    scheduled,
    inProgress,
    overdue,
    completed,
    gaps,
    overbooked,
    gapCount: gaps.length,
    summary: {
      scheduledCount: scheduled.length,
      inProgressCount: inProgress.length,
      overdueCount: overdue.length,
      completedCount: completed.length,
      gapCount: gaps.length,
    },
  };
}
