import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

export const MANAGEMENT_OVERVIEW_KEY = "management_overview_v1";

const TEAM_COLOURS = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c", "#0369a1"];

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
};

function validTeam(team, index) {
  return {
    id: String(team?.id || `team_${Date.now()}_${index}`),
    name: String(team?.name || `Team ${index + 1}`).slice(0, 60),
    colour: /^#[0-9a-f]{6}$/i.test(team?.colour || "") ? team.colour : TEAM_COLOURS[index % TEAM_COLOURS.length],
    capacity: Math.max(1, Math.min(7, Number(team?.capacity) || 5)),
    region: String(team?.region || "").slice(0, 60),
  };
}

export function normaliseManagementState(raw) {
  const teams = Array.isArray(raw?.teams) && raw.teams.length
    ? raw.teams.slice(0, 30).map(validTeam)
    : DEFAULT_MANAGEMENT_TEAMS.map((team) => ({ ...team }));
  return {
    teams,
    jobs: raw?.jobs && typeof raw.jobs === "object" && !Array.isArray(raw.jobs) ? raw.jobs : {},
    opportunities: Array.isArray(raw?.opportunities) ? raw.opportunities.slice(0, 100) : [],
    calendar: {
      ...EMPTY_MANAGEMENT_STATE.calendar,
      ...(raw?.calendar && typeof raw.calendar === "object" ? raw.calendar : {}),
      groupName: String(raw?.calendar?.groupName || EMPTY_MANAGEMENT_STATE.calendar.groupName).slice(0, 60),
      managementCalendar: String(raw?.calendar?.managementCalendar || EMPTY_MANAGEMENT_STATE.calendar.managementCalendar).slice(0, 60),
      connectedProvider: ["google", "microsoft"].includes(raw?.calendar?.connectedProvider) ? raw.calendar.connectedProvider : "",
    },
    meeting: {
      ...EMPTY_MANAGEMENT_STATE.meeting,
      ...(raw?.meeting && typeof raw.meeting === "object" ? raw.meeting : {}),
      title: String(raw?.meeting?.title || EMPTY_MANAGEMENT_STATE.meeting.title).slice(0, 100),
      attendees: String(raw?.meeting?.attendees || "").slice(0, 500),
      notes: String(raw?.meeting?.notes || "").slice(0, 5000),
      actions: Array.isArray(raw?.meeting?.actions) ? raw.meeting.actions.slice(0, 200) : [],
    },
  };
}

export function loadManagementState() {
  return normaliseManagementState(loadOrgScoped(MANAGEMENT_OVERVIEW_KEY, null));
}

export function saveManagementState(state) {
  return saveOrgScoped(MANAGEMENT_OVERVIEW_KEY, normaliseManagementState(state));
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

export function readinessForJob(job) {
  const checks = job?.readiness || {};
  const values = ["dates", "team", "rams", "permits", "survey", "client"].map((key) => Boolean(checks[key]));
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

export function jobTone(job) {
  if (job?.status === "cancelled" || job?.status === "delayed" || job?.status === "blocked") return "red";
  if (job?.status === "completed") return "green";
  const readiness = readinessForJob(job);
  if (job?.status === "confirmed" && readiness === 100) return "green";
  return readiness < 50 ? "red" : "amber";
}

export function monthCapacity(jobs, team, monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12);
  const workingDaysPerWeek = Math.max(1, Math.min(7, Number(team?.capacity) || 5));
  const totalWorkingDays = Math.round(workingDaysBetween(isoDate(start), isoDate(end)) * (workingDaysPerWeek / 5));
  const booked = jobs
    .filter((job) => job.teamId === team.id && job.status !== "cancelled")
    .reduce((sum, job) => {
      const jobStart = dateOnly(job.start);
      const jobEnd = dateOnly(job.end);
      if (!jobStart || !jobEnd || jobEnd < start || jobStart > end) return sum;
      return sum + workingDaysBetween(isoDate(jobStart < start ? start : jobStart), isoDate(jobEnd > end ? end : jobEnd));
    }, 0);
  const percentage = totalWorkingDays ? Math.round((booked / totalWorkingDays) * 100) : 0;
  return { booked, total: totalWorkingDays, percentage };
}
