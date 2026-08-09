import { addDays, cleanText, dateOnly, isoDate, readinessForJob } from "./managementOverview";

/**
 * ICS builder for the management programme.
 *
 * Two things matter here beyond formatting. First, every value is escaped per RFC 5545:
 * a job name carrying a newline or a colon must never be able to close a property and
 * inject its own (a calendar client would happily import an attacker-supplied ATTENDEE
 * or URL otherwise). Second, the Calendar Hub switches are honoured — they used to be
 * decoration while the export always emitted every job.
 */

const MAX_EVENTS = 1500;
const MAX_LINE = 73;
/** Everything unprintable except newline, which is escaped rather than dropped. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point: they are stripped.
const CONTROL_CHARS = /[\x00-\x09\x0b-\x1f\x7f]/g;
const BACKSLASH = String.fromCharCode(92);

/** Escape a text value for an ICS property (RFC 5545 §3.3.11). */
export function escapeIcsText(value, max = 300) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .split(BACKSLASH)
    .join(BACKSLASH + BACKSLASH)
    .replace(/([;,])/g, `${BACKSLASH}$1`)
    .split("\n")
    .join(`${BACKSLASH}n`)
    .slice(0, max);
}

/** UIDs are opaque: keep them to characters that can never break the line. */
export function safeIcsUid(value, fallback) {
  const cleaned = String(value ?? "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80);
  return cleaned || fallback;
}

/** Fold long content lines (RFC 5545 §3.1) so Outlook and Apple Calendar accept them. */
export function foldIcsLine(line) {
  if (line.length <= MAX_LINE) return line;
  const parts = [line.slice(0, MAX_LINE)];
  let rest = line.slice(MAX_LINE);
  while (rest.length) {
    parts.push(` ${rest.slice(0, MAX_LINE - 1)}`);
    rest = rest.slice(MAX_LINE - 1);
  }
  return parts.join("\r\n");
}

function dateStamp(value) {
  return String(value || "").replaceAll("-", "");
}

function utcStamp(date) {
  const iso = new Date(date).toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

function icsStatus(status) {
  if (status === "confirmed" || status === "completed") return "CONFIRMED";
  if (status === "cancelled") return "CANCELLED";
  return "TENTATIVE";
}

function allDayEvent({ uid, start, end, summary, location, description, categories, status, stamp }) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateStamp(start)}`,
    `DTEND;VALUE=DATE:${dateStamp(end)}`,
    `SUMMARY:${escapeIcsText(summary, 200)}`,
  ];
  if (location) lines.push(`LOCATION:${escapeIcsText(location, 200)}`);
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description, 500)}`);
  if (categories) lines.push(`CATEGORIES:${escapeIcsText(categories, 100)}`);
  if (status) lines.push(`STATUS:${status}`);
  lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  return lines;
}

/**
 * Build the management calendar as an ICS document.
 *
 * @param {object} input
 * @param {object[]} input.jobs Jobs and pipeline opportunities as shown in the planner.
 * @param {{id: string, name: string}[]} [input.teams]
 * @param {object} [input.calendar] The Calendar Hub settings from the management document.
 * @param {object[]} [input.actions] Meeting actions, exported when the compliance switch is on.
 * @param {Date} [input.now] Injectable clock so the output is testable.
 * @param {string} [input.ramsLabel] Market term for the method statement (RAMS / SWMS / IOR).
 * @returns {string} ICS document with CRLF line endings.
 */
export function buildManagementIcs({ jobs = [], teams = [], calendar = {}, actions = [], now = new Date(), ramsLabel = "RAMS" } = {}) {
  const stamp = utcStamp(now);
  const teamName = (teamId) => (Array.isArray(teams) ? teams : []).find((team) => team?.id === teamId)?.name || "";
  const includeProvisional = calendar.includeProvisional !== false;
  const includeDeadlines = calendar.includeDeadlines !== false;
  const includeCompliance = calendar.includeCompliance !== false;
  const labelByTeam = calendar.separateTeamCalendars !== false;
  const groupName = cleanText(calendar.groupName, 60) || "MySafeOps";
  const managementCalendar = cleanText(calendar.managementCalendar, 60) || "Management programme";

  const body = [];
  let eventCount = 0;
  const push = (lines) => {
    if (eventCount >= MAX_EVENTS) return;
    eventCount += 1;
    body.push(...lines);
  };

  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!job?.start || job.status === "cancelled") continue;
    const provisional = job.status === "provisional" || job.source === "opportunity";
    if (provisional && !includeProvisional) continue;
    const team = teamName(job.teamId);
    const finish = isoDate(addDays(dateOnly(job.end || job.start), 1));
    push(
      allDayEvent({
        uid: `${safeIcsUid(job.id, `job-${eventCount}`)}@mysafeops`,
        start: job.start,
        end: finish,
        summary: labelByTeam && team ? `${team} · ${job.name}` : job.name,
        location: job.site,
        description: `${job.client || "Client TBC"} · ${readinessForJob(job)}% ready · ${job.status || "provisional"}`,
        categories: team ? `${managementCalendar},${team}` : managementCalendar,
        status: icsStatus(job.status),
        stamp,
      }),
    );

    if (!includeDeadlines) continue;
    const missing = [
      !job.readiness?.rams && ramsLabel,
      !job.readiness?.permits && "Permits",
      !job.readiness?.survey && "Survey",
    ].filter(Boolean);
    if (!missing.length) continue;
    const jobStart = dateOnly(job.start);
    const dueDate = isoDate(addDays(jobStart, -7));
    push(
      allDayEvent({
        uid: `${safeIcsUid(job.id, `job-${eventCount}`)}-docs@mysafeops`,
        start: dueDate,
        end: isoDate(addDays(dateOnly(dueDate), 1)),
        summary: `Documents due: ${job.name}`,
        description: `Outstanding before mobilisation: ${missing.join(", ")}.`,
        categories: `${managementCalendar},Document deadlines`,
        status: "TENTATIVE",
        stamp,
      }),
    );
  }

  if (includeCompliance) {
    for (const action of Array.isArray(actions) ? actions : []) {
      if (!action?.due || action.status === "Done") continue;
      push(
        allDayEvent({
          uid: `${safeIcsUid(action.id, `action-${eventCount}`)}-action@mysafeops`,
          start: action.due,
          end: isoDate(addDays(dateOnly(action.due), 1)),
          summary: `Action due: ${action.text}`,
          description: `Owner: ${action.owner || "Unassigned"} · Status: ${action.status || "Open"}`,
          categories: `${managementCalendar},Compliance`,
          status: "TENTATIVE",
          stamp,
        }),
      );
    }
  }

  const document = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MySafeOps//Management Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(groupName, 60)}`,
    `X-WR-CALDESC:${escapeIcsText(managementCalendar, 60)}`,
    ...body,
    "END:VCALENDAR",
  ];

  return `${document.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** Count of events the current settings would export — used for the download hint. */
export function countIcsEvents(ics) {
  return (String(ics || "").match(/^BEGIN:VEVENT$/gm) || []).length;
}
