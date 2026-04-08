/**
 * Build site presence updates from today's daily briefing (B1).
 * Only workers marked present **with signature** are included; guests (external ids) are skipped.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * @param {object[]} briefings `daily_briefings` entries
 * @param {{ id: string }[]} workers current org workers (for id filter)
 * @param {object} currentPresence existing `mysafeops_site_presence` map
 * @param {{ date?: string }} [opts] defaults to calendar today (local interpreted as ISO date on briefing records)
 * @returns {{ ok: true, presence: object, message: string, count: number, projectId: string } | { ok: false, message: string }}
 */
export function presenceFromTodaysBriefing(briefings, workers, currentPresence, opts = {}) {
  const dateKey = opts.date ?? todayIso();
  const list = Array.isArray(briefings) ? briefings : [];
  const todays = list.filter((b) => b && b.date === dateKey);
  if (todays.length === 0) {
    return { ok: false, message: "No daily briefing dated today. Create one under Daily briefing, or pick a briefing date that matches today." };
  }
  const brief = [...todays].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  })[0];

  if (!brief.projectId || String(brief.projectId).trim() === "") {
    return {
      ok: false,
      message: "Today's briefing has no project selected. Edit the briefing record or create a new one with a project.",
    };
  }

  const workerIds = new Set((workers || []).map((w) => w.id).filter(Boolean));
  const signedPresent = (brief.attendees || []).filter((a) => a && a.present && a.sig && workerIds.has(a.id));

  if (signedPresent.length === 0) {
    return {
      ok: false,
      message: "No attendees on today's briefing are both present and signed (worker list only). Signatures are required to sync to the map.",
    };
  }

  const now = new Date().toISOString();
  const activityBase =
    (brief.scopeToday && String(brief.scopeToday).trim().slice(0, 120)) ||
    (brief.location && `Daily briefing — ${String(brief.location).trim().slice(0, 80)}`) ||
    "Daily briefing";

  const presence = { ...(currentPresence && typeof currentPresence === "object" ? currentPresence : {}) };
  for (const a of signedPresent) {
    presence[a.id] = {
      projectId: brief.projectId,
      activity: activityBase,
      updatedAt: now,
    };
  }

  return {
    ok: true,
    presence,
    count: signedPresent.length,
    projectId: brief.projectId,
    message: `Applied ${signedPresent.length} worker(s) from today's briefing to this project on the map.`,
  };
}
