import { getWorkerCertAlerts } from "./certifications";

/**
 * Crew rosters for management teams.
 *
 * A team used to be a name, a colour and a number of working days — the workers register
 * was never connected to it. Planning capacity without knowing who is in the team (and
 * whether their certification is still valid) is how an unqualified crew ends up on site.
 */

/**
 * @param {{id: string, name?: string, memberIds?: string[]}[]} teams
 * @param {object[]} workers Workers register rows.
 * @param {Date} [now]
 * @returns {Map<string, {team: object, members: object[], count: number, expired: number, expiringSoon: number, missingIds: string[]}>}
 */
export function buildCrewByTeam(teams = [], workers = [], now = new Date()) {
  const workerById = new Map((Array.isArray(workers) ? workers : []).filter((worker) => worker?.id).map((worker) => [String(worker.id), worker]));
  const crew = new Map();

  for (const team of Array.isArray(teams) ? teams : []) {
    if (!team?.id) continue;
    const members = [];
    const missingIds = [];
    let expired = 0;
    let expiringSoon = 0;

    for (const memberId of team.memberIds || []) {
      const worker = workerById.get(String(memberId));
      // A worker removed from the register leaves a dangling id; surface it rather than hide it.
      if (!worker) {
        missingIds.push(String(memberId));
        continue;
      }
      const alerts = getWorkerCertAlerts(worker, now);
      const hasExpired = alerts.some((alert) => alert.severity === "expired");
      const expiringSoonOnly = !hasExpired && alerts.length > 0;
      if (hasExpired) expired += 1;
      if (expiringSoonOnly) expiringSoon += 1;
      members.push({ ...worker, certAlerts: alerts, hasExpiredCert: hasExpired });
    }

    crew.set(team.id, { team, members, count: members.length, expired, expiringSoon, missingIds });
  }

  return crew;
}

/** Teams that have work booked but nobody rostered, plus crews with expired certification. */
export function crewWarnings(crewByTeam, jobs = []) {
  const bookedTeamIds = new Set(
    (Array.isArray(jobs) ? jobs : [])
      .filter((job) => job?.teamId && job.status !== "cancelled" && job.status !== "completed")
      .map((job) => job.teamId),
  );

  const empty = [];
  const expired = [];
  for (const [teamId, entry] of crewByTeam || []) {
    if (!bookedTeamIds.has(teamId)) continue;
    if (entry.count === 0) empty.push(entry.team);
    else if (entry.expired > 0) expired.push({ team: entry.team, expired: entry.expired });
  }
  return { empty, expired };
}

/** Workers not rostered to any team — the pool the picker offers first. */
export function unassignedWorkers(teams = [], workers = []) {
  const assigned = new Set((Array.isArray(teams) ? teams : []).flatMap((team) => team?.memberIds || []).map(String));
  return (Array.isArray(workers) ? workers : []).filter((worker) => worker?.id && !assigned.has(String(worker.id)));
}
