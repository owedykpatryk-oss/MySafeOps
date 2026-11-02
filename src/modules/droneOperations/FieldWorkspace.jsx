import { useState } from "react";
import DroneMap from "./DroneMap.jsx";
import { appendFieldEvent, FIELD_EVENTS, fieldSessionState } from "./fieldSession.js";
import { actionSection } from "./droneReminders.js";
import { CloseoutReview } from "./MissionWorkflow.jsx";
import { useMissionDraft } from "./useMissionDraft.js";

const labels = {
  idle: "Not started",
  active: "Site session active",
  paused: "Site session paused",
  closed: "Site session closed",
  invalid: "History needs review",
};
const buttons = {
  start: "Start site session",
  pause: "Pause site session",
  resume: "Resume site session",
  close: "Close site session",
};
const locations = [
  ["takeoff", "T", "Take-off"],
  ["landing", "L", "Landing"],
  ["alternateLanding", "A", "Alternate landing"],
];
const validLocation = (point) =>
  Array.isArray(point) &&
  point.length === 2 &&
  point.every(Number.isFinite) &&
  Math.abs(point[0]) <= 180 &&
  Math.abs(point[1]) <= 90;
export function LandingLocations({ mission, onPatch, disabled = false }) {
  return (
    <div className="field-locations">
      {locations.map(([key, symbol, label]) => (
        <div key={key}>
          <span className="field-location-symbol">{symbol}</span>
          <div>
            <strong>{label}</strong>
            <p>
              {validLocation(mission[key])
                ? mission[key].join(", ")
                : mission[key] == null
                  ? "Not recorded"
                  : "Invalid point — choose it again on the map"}
            </p>
            {key !== "takeoff" && onPatch && (
              <div className="drone-actions">
                {key === "landing" && (
                  <button
                    type="button"
                    disabled={disabled || !validLocation(mission.takeoff)}
                    onClick={() => onPatch({ landing: [...mission.takeoff] })}
                  >
                    Use take-off point
                  </button>
                )}
                {mission[key] && (
                  <button type="button" disabled={disabled} onClick={() => onPatch({ [key]: null })}>
                    Clear {label.toLowerCase()}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
export default function FieldWorkspace({
  mission,
  actor,
  assessment,
  definitions,
  at,
  canEdit,
  busy,
  offline,
  onSave,
  onNavigate,
  onExport,
}) {
  const draft = useMissionDraft("session-note", mission, actor, { pending: "", note: "" });
  const { pending, note } = draft.values;
  const setNote = (value) => draft.set((f) => ({ ...f, note: value }));
  const [error, setError] = useState("");
  const journal = Array.isArray(mission.fieldJournal) ? mission.fieldJournal : [],
    state = fieldSessionState(journal);
  const primary = { idle: "start", active: "pause", paused: "resume" }[state];
  const disabled = !canEdit || busy;
  const planChanged = journal.length > 0 && journal.at(-1)?.missionRevision !== mission.revision;
  const formatTime = (at) => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: mission.timeZone,
      }).format(new Date(at));
    } catch {
      return at;
    }
  };
  function record(type) {
    try {
      if (draft.revisionChanged && pending)
        throw new Error("Review the session note against the changed plan before recording it.");
      const saved = onSave(appendFieldEvent(mission, type, note, actor));
      if (!saved) {
        setError("The session record was not saved. Review the save message and try again.");
        return;
      }
      draft.reset();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function choose(type) {
    if (pending && note.trim() && pending !== type) {
      setError("Save or discard the current session note before choosing a different action.");
      return;
    }
    setError("");
    draft.set({ pending: type, note: pending === type ? note : "" });
  }
  function entry(event, index) {
    if (!event || typeof event !== "object")
      return <li key={`invalid:${index}`}>Invalid session entry — review the source record.</li>;
    return (
      <li key={event.id}>
        <span className="field-event-dot" aria-hidden="true" />
        <div>
          <strong>
            {Object.hasOwn(FIELD_EVENTS, event.type) ? FIELD_EVENTS[event.type] : "Unrecognised session event"}
          </strong>
          <p>{event.note || "Site coordination opened"}</p>
          <small>
            <time dateTime={event.at}>{formatTime(event.at)}</time> · {event.by} · plan r{event.missionRevision}
          </small>
        </div>
      </li>
    );
  }
  return (
    <div className="field-workspace">
      <section className="field-command" data-state={state} aria-labelledby="field-title">
        <div className="field-command-copy">
          <p className="field-eyebrow">
            ON SITE / {mission.aircraftKind === "helicopter" ? "HELICOPTER SURVEY" : "DRONE SURVEY"}
          </p>
          <h2 id="field-title">{mission.title}</h2>
          <p>{mission.location || "Site location not recorded"}</p>
          <div className="field-state" role="status">
            <span aria-hidden="true" />
            {labels[state]}
          </div>
          <p className="field-command-caption">
            Start, pause and close the team's site session. These controls do not operate an aircraft or authorise a
            flight.
          </p>
        </div>
        <div className="field-controls">
          {primary && (
            <button
              className="field-primary"
              type="button"
              disabled={disabled || (mission.cancelled && ["start", "resume"].includes(primary))}
              onClick={() => (primary === "start" ? record(primary) : choose(primary))}
            >
              {buttons[primary]}
            </button>
          )}
          {["active", "paused"].includes(state) && (
            <button className="field-close" type="button" disabled={disabled} onClick={() => choose("close")}>
              Close site session
            </button>
          )}
          {state === "closed" && <p>Session complete. Its history remains with this mission.</p>}
          <small>
            {offline
              ? "Offline · records save on this device; cloud sync is pending."
              : "Records save on this device; check the sync status above for cloud confirmation."}
          </small>
        </div>
      </section>
      {pending && (
        <form
          className="drone-card field-note"
          onSubmit={(e) => {
            e.preventDefault();
            record(pending);
          }}
        >
          <h3>{buttons[pending]}</h3>
          <p className="drone-note" role="status">
            {draft.storageError
              ? "Draft recovery is unavailable. Keep this tab open until the note is saved."
              : `${draft.restored ? "Draft restored. " : ""}This unsubmitted note is kept in this browser tab.`}
          </p>
          {draft.revisionChanged && (
            <div className="drone-warning" role="alert">
              <p>
                The plan changed from revision {draft.sourceRevision} to {mission.revision}. Review this note before
                recording it.
              </p>
              <button type="button" disabled={disabled} onClick={draft.confirmRevision}>
                I reviewed this note against the current plan
              </button>
            </div>
          )}
          <label>
            Session note
            <textarea
              aria-label="Session note"
              autoFocus
              required
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                pending === "pause"
                  ? "Why has work paused? What needs attention?"
                  : pending === "resume"
                    ? "What changed and what was reviewed with the team?"
                    : "Handover, equipment, outstanding actions and next steps"
              }
            />
          </label>
          {pending === "pause" && (
            <div className="drone-actions" aria-label="Pause reason suggestions">
              {["Weather review", "Site access", "Equipment issue", "Team / operator coordination"].map((reason) => (
                <button
                  type="button"
                  key={reason}
                  disabled={disabled || note.includes(reason) || note.length + reason.length + 1 > 2000}
                  onClick={() => setNote(note.trim() ? `${note}\n${reason}` : reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
          )}
          <p>Recorded by {actor.name}. This note does not complete outstanding checks.</p>
          <div className="drone-actions">
            <button type="submit" disabled={disabled || !note.trim() || draft.revisionChanged}>
              Save session record
            </button>
            <button
              type="button"
              onClick={() => {
                draft.reset();
                setError("");
              }}
            >
              Discard note
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="drone-warning">
          {error}
        </p>
      )}
      {planChanged && (
        <p className="drone-warning" role="status">
          The plan changed after the last session record (r{journal.at(-1)?.missionRevision || "unknown"} → r
          {mission.revision}). Review the current plan and brief the team before continuing work.
        </p>
      )}
      <CloseoutReview
        mission={mission}
        definitions={definitions}
        at={at}
        onNavigate={onNavigate}
        onExport={onExport}
        busy={busy}
      />
      <div className="field-body">
        <div>
          <section className="drone-card">
            <div className="field-section-head">
              <div>
                <p className="field-eyebrow">GROUND ARRANGEMENTS</p>
                <h3>Start, landing & alternatives</h3>
              </div>
              <button type="button" onClick={() => onNavigate("overview")}>
                Edit mission map
              </button>
            </div>
            <DroneMap mission={mission} readOnly />
            <LandingLocations mission={mission} />
            <small>
              WGS84: longitude, latitude. Locations are planning references; suitability must be assessed on site.
            </small>
          </section>
          <section className="drone-card">
            <h3>Emergency & communications</h3>
            <p className="field-preserve">{mission.emergency || "Emergency arrangements have not been recorded."}</p>
            {mission.helicopter?.communications && (
              <p className="field-preserve">{mission.helicopter.communications}</p>
            )}
            <button type="button" onClick={() => onNavigate("checklist")}>
              Open briefing & checklist
            </button>
          </section>
        </div>
        <div>
          <section className="drone-card field-review">
            <p className="field-eyebrow">CURRENT PLAN · REVISION {mission.revision}</p>
            <h3>
              {assessment.actions.length
                ? `${assessment.actions.length} actions to review`
                : "Review the flight decision"}
            </h3>
            <p>{assessment.status}. Session activity does not certify flight readiness.</p>
            <ul>
              {assessment.actions.slice(0, 3).map((action, i) => (
                <li key={`${action.key}:${i}`}>
                  <button type="button" onClick={() => onNavigate(actionSection(action.key))}>
                    {action.text}
                    <span aria-hidden="true"> →</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="drone-actions">
              <button type="button" onClick={() => onNavigate("review")}>
                Review all actions
              </button>
              <button type="button" disabled={busy} onClick={() => onExport("field")}>
                Download field card
              </button>
            </div>
          </section>
          <section className="drone-card">
            <p className="field-eyebrow">SESSION JOURNAL</p>
            <h3>What happened on site</h3>
            <p>Times: {mission.timeZone || "UTC"}. Recorded account names are not authenticated pilot signatures.</p>
            {!journal.length ? (
              <p>No session events yet. Start when the site team begins its work.</p>
            ) : (
              <ol className="field-timeline">{journal.slice(-5).reverse().map(entry)}</ol>
            )}
            {journal.length > 5 && (
              <details>
                <summary>Show {journal.length - 5} earlier records</summary>
                <ol className="field-timeline">{journal.slice(0, -5).reverse().map(entry)}</ol>
              </details>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
