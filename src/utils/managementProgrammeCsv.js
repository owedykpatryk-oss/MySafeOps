import { cleanMoney, jobSchedulePhase, jobTone, readinessForJob } from "./managementOverview";

/**
 * CSV export of the management programme.
 *
 * Values are quoted and any leading =, +, - or @ is neutralised: a job name typed as a
 * formula must land in Excel as text, not as something the spreadsheet evaluates.
 */

const HEADERS = [
  "Job",
  "Client",
  "Location",
  "Team",
  "Status",
  "Phase",
  "Start",
  "Finish",
  "Readiness %",
  "Value",
  "Source",
  "Conflict",
];

/** Escape one CSV field (RFC 4180) and defuse spreadsheet formula injection. */
export function csvCell(value) {
  let text = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.split('"').join('""')}"`;
}

/**
 * @param {object[]} jobs
 * @param {object} [options]
 * @param {{id: string, name?: string}[]} [options.teams]
 * @param {Set<string>} [options.conflictedIds]
 * @param {Date|string} [options.today]
 */
export function buildProgrammeCsv(jobs = [], { teams = [], conflictedIds, today = new Date() } = {}) {
  const teamName = (teamId) => teams.find((team) => team?.id === teamId)?.name || "Unassigned";
  const rows = (Array.isArray(jobs) ? jobs : []).map((job) => [
    job.name,
    job.client,
    job.site,
    teamName(job.teamId),
    job.status,
    jobSchedulePhase(job, today),
    job.start,
    job.end,
    readinessForJob(job),
    cleanMoney(job.value) || "",
    job.source === "opportunity" ? "Pipeline" : "Project",
    conflictedIds?.has(job.id) ? "Yes" : "No",
  ]);

  return [HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Tone counts for the export summary toast. */
export function summariseProgramme(jobs = []) {
  const counts = { green: 0, amber: 0, red: 0 };
  for (const job of Array.isArray(jobs) ? jobs : []) counts[jobTone(job)] += 1;
  return counts;
}
