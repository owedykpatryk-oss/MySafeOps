// Coordination records only. No state in this journal is an aircraft command or flight release.
export const FIELD_EVENTS = {
  start: "Site session started",
  pause: "Site session paused",
  resume: "Site session resumed",
  close: "Site session closed",
};
const transitions = {
  idle: { start: "active" },
  active: { pause: "paused", close: "closed" },
  paused: { resume: "active", close: "closed" },
  closed: {},
};
const nextState = (state, type) =>
  typeof type === "string" && Object.hasOwn(transitions, state) && Object.hasOwn(transitions[state], type)
    ? transitions[state][type]
    : null;
export function fieldSessionState(journal = []) {
  if (!Array.isArray(journal)) return "invalid";
  return journal.reduce((state, event) => nextState(state, event?.type) || "invalid", "idle");
}
export function validateFieldJournal(before = [], after = [], actorId, revision, now = Date.now()) {
  if (!Array.isArray(before) || !Array.isArray(after) || after.length > 1000) return "invalid_field_journal";
  if (after.length < before.length || before.some((event, i) => JSON.stringify(event) !== JSON.stringify(after[i])))
    return "field_journal_is_append_only";
  let state = "idle",
    lastAt = 0;
  const ids = new Set();
  for (const [i, event] of after.entries()) {
    if (
      !event ||
      typeof event !== "object" ||
      Object.keys(event).sort().join(",") !== "at,by,id,missionRevision,note,type,userId" ||
      typeof event.id !== "string" ||
      !event.id ||
      ids.has(event.id) ||
      typeof event.by !== "string" ||
      !event.by.trim() ||
      event.by.length > 200 ||
      typeof event.note !== "string" ||
      event.note.length > 2000 ||
      (event.type !== "start" && !event.note.trim()) ||
      !Number.isInteger(event.missionRevision) ||
      event.missionRevision < 1 ||
      event.missionRevision > revision ||
      !Number.isFinite(Date.parse(event.at)) ||
      Date.parse(event.at) < lastAt ||
      Date.parse(event.at) > now + 300000 ||
      !nextState(state, event.type)
    )
      return "invalid_field_journal";
    if (i >= before.length && event.userId !== actorId) return "invalid_field_actor";
    ids.add(event.id);
    state = nextState(state, event.type);
    lastAt = Date.parse(event.at);
  }
  return null;
}
export function appendFieldEvent(mission, type, note, actor, now = Date.now()) {
  if (!["admin", "supervisor"].includes(actor?.role) || !actor?.name?.trim())
    throw new Error("A named supervisor or administrator must record the session.");
  if (mission.cancelled && ["start", "resume"].includes(type))
    throw new Error("A cancelled mission cannot start or resume a site session.");
  if (!nextState(fieldSessionState(mission.fieldJournal), type))
    throw new Error("This session action is unavailable. Review the current state.");
  if (type !== "start" && !String(note || "").trim()) throw new Error("Add a note before recording this action.");
  const event = {
    id: crypto.randomUUID(),
    type,
    at: new Date(now).toISOString(),
    by: actor.name.trim(),
    userId: actor.id || null,
    missionRevision: mission.revision,
    note: String(note || "").trim(),
  };
  const journal = [...(mission.fieldJournal || []), event];
  const error = validateFieldJournal(mission.fieldJournal, journal, event.userId, mission.revision, now);
  if (error) throw new Error("Session record could not be saved. Check the note, clock and current mission.");
  return { ...mission, fieldJournal: journal, updatedAt: event.at };
}
export function fieldJournalText(mission) {
  return (
    "Site coordination record only; this is not a flight log or flight authorisation. Times below are UTC.\n\n" +
    ((Array.isArray(mission.fieldJournal) ? mission.fieldJournal : [])
      .map((event) =>
        !event || typeof event !== "object"
          ? "Invalid session entry — review the source record."
          : `${Object.hasOwn(FIELD_EVENTS, event.type) ? FIELD_EVENTS[event.type] : "Unrecognised session event"}\n${event.at || "Time not recorded"} | ${String(event.by || "").trim() || "Recorder not recorded"} | Planning revision ${event.missionRevision || "not recorded"}\n${event.note || "No additional note"}`
      )
      .join("\n\n") || "No site session recorded.")
  );
}
