import { cleanMoney, jobSchedulePhase, jobTone, sumJobValue } from "./managementOverview";

/**
 * The programme grouped by client.
 *
 * Every other view answers "what happens next"; this one answers "who is this work for" —
 * which client carries the value, who has work running today, and where the trouble is
 * concentrated. It is derived entirely from jobs already on the plan, so nothing extra has
 * to be recorded to get it.
 */

const UNNAMED = "Client not set";

/**
 * @param {object[]} jobs
 * @param {object} [options]
 * @param {Date|string} [options.today]
 * @param {Set<string>} [options.conflictedIds]
 * @returns {{
 *   key: string, name: string, jobs: object[], counts: object,
 *   value: {live: number, scheduled: number, pipeline: number, completed: number, total: number},
 *   nextStart: string, attention: number, conflicts: number
 * }[]} sorted by total value, then by job count, then by name
 */
export function groupJobsByClient(jobs = [], { today = new Date(), conflictedIds } = {}) {
  const groups = new Map();

  for (const job of Array.isArray(jobs) ? jobs : []) {
    const name = String(job?.client || "").trim() || UNNAMED;
    const key = name.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        jobs: [],
        counts: { total: 0, live: 0, upcoming: 0, overdue: 0, completed: 0, pipeline: 0 },
        nextStart: "",
        attention: 0,
        conflicts: 0,
      });
    }

    const group = groups.get(key);
    const phase = jobSchedulePhase(job, today);
    group.jobs.push({ ...job, phase });
    group.counts.total += 1;
    if (phase === "active") group.counts.live += 1;
    if (phase === "upcoming") group.counts.upcoming += 1;
    if (phase === "overdue") group.counts.overdue += 1;
    if (phase === "done") group.counts.completed += 1;
    if (job.source === "opportunity") group.counts.pipeline += 1;
    if (phase !== "done" && phase !== "cancelled" && jobTone(job) !== "green") group.attention += 1;
    if (conflictedIds?.has(job.id)) group.conflicts += 1;
    // Earliest future start, so the row can say when this client is next on site.
    if (phase === "upcoming" && (!group.nextStart || job.start < group.nextStart)) group.nextStart = job.start;
  }

  const rows = [...groups.values()].map((group) => {
    // Won work is everything that is not an unwon pipeline opportunity. The three buckets
    // below partition it exactly, so they always add up to the total.
    const won = group.jobs.filter((job) => job.source !== "opportunity" && job.status !== "cancelled");
    const live = won.filter((job) => job.phase === "active" || job.phase === "overdue");
    const scheduled = won.filter((job) => job.phase === "upcoming" || job.phase === "unscheduled");
    const completed = won.filter((job) => job.phase === "done");
    const pipeline = group.jobs.filter((job) => job.source === "opportunity" && job.status !== "cancelled");
    const value = {
      live: sumJobValue(live),
      scheduled: sumJobValue(scheduled),
      pipeline: sumJobValue(pipeline),
      completed: sumJobValue(completed),
      // Pipeline stays out of the total: it is not won, and would flatter the ranking.
      total: sumJobValue(won),
    };
    return {
      ...group,
      value,
      jobs: group.jobs.sort((a, b) => String(a.start || "9999-12-31").localeCompare(String(b.start || "9999-12-31"))),
    };
  });

  return rows.sort(
    (a, b) => b.value.total - a.value.total || b.counts.total - a.counts.total || a.name.localeCompare(b.name),
  );
}

/** Headline numbers for the client view. */
export function summariseClients(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const withWork = list.filter((row) => row.counts.total - row.counts.pipeline > 0);
  const totalValue = list.reduce((sum, row) => sum + cleanMoney(row.value.total), 0);
  const top = list[0] || null;
  return {
    clients: list.length,
    clientsWithWork: withWork.length,
    totalValue,
    // Revenue concentration: one client carrying most of the book is a commercial risk.
    topShare: top && totalValue > 0 ? Math.round((top.value.total / totalValue) * 100) : 0,
    topName: top?.name || "",
  };
}
