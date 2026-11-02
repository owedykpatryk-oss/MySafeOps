import { useState } from "react";
import { evidenceKinds, addEvidence } from "./droneMission.js";
import { regionalSources } from "./droneRegions.js";
import { airspaceBriefing } from "./airspaceBriefing.js";
import { downloadMapLayer } from "./mapTools.js";
import { useMissionDraft } from "./useMissionDraft.js";

export default function DroneEvidence({ mission, onSave, actor, documents, canEdit }) {
  const EVIDENCE_KINDS = evidenceKinds(mission);
  const briefing = airspaceBriefing(mission);
  const blank = () => ({
    kind: "airspace",
    source: "",
    note: "",
    reviewer: actor.name,
    result: "reviewed",
    checkedAt: new Date().toISOString().slice(0, 16),
    validUntil: "",
    documentId: "",
  });
  const draft = useMissionDraft("evidence", mission, actor, blank());
  const form = draft.values;
  const [error, setError] = useState("");
  const set = (key, value) => draft.set((f) => ({ ...f, [key]: value }));
  function save() {
    try {
      if (draft.revisionChanged)
        throw new Error("Review this draft against the changed mission before saving evidence.");
      const saved = onSave(
        addEvidence(mission, { ...form, checkedAt: `${form.checkedAt}:00Z`, validUntil: `${form.validUntil}:00Z` })
      );
      if (!saved)
        throw new Error("Evidence was not saved. Your entries have been kept; retry when saving is available.");
      draft.reset();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="drone-card">
      <h2>Checks and permissions</h2>
      <h3>Briefing prepared from your map</h3>
      <p>
        Coordinates, operating areas, height and UTC times update automatically as the mission changes. Open the
        official service, obtain the briefing, then record its findings below.
      </p>
      <textarea
        aria-label="Prepared airspace briefing request"
        readOnly
        rows={9}
        value={briefing.text}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      <div className="drone-actions">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(briefing.text);
              setError("");
            } catch {
              setError("Copy unavailable. Select and copy the prepared text above.");
            }
          }}
        >
          Copy briefing request
        </button>
        <button
          type="button"
          disabled={!briefing.hasGeometry}
          onClick={() => {
            try {
              downloadMapLayer({ ...mission, boundary: briefing.geometry }, "boundary", "kml");
              setError("");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Download briefing area KML
        </button>
        {briefing.sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
            {source.title}
          </a>
        ))}
      </div>
      <p>
        Airspace API: <strong>Not connected</strong>. Complete an official briefing for the whole operating volume and
        time window, then record the result and supporting evidence.
      </p>
      <p>
        {regionalSources(mission)
          .filter((s) => s.kind !== "manufacturer")
          .map((s) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
              {" · "}
            </span>
          ))}
      </p>
      <p className="drone-note">
        No detected restriction does not prove complete coverage. Controlled airspace and NOTAMs are not automatically
        prohibitions. Keep AGL, AMSL and FL distinct; unresolved vertical references need review. A NOTAM or landowner
        consent is not an airspace permission.
      </p>
      <fieldset disabled={!canEdit}>
        {draft.dirty && (
          <p role="status" className="drone-note">
            {draft.storageError
              ? "Draft recovery is unavailable. Keep this tab open until the evidence is saved."
              : `${draft.restored ? "Draft restored. " : ""}Unsubmitted draft kept in this browser tab; it is not saved evidence.`}
          </p>
        )}
        {draft.revisionChanged && (
          <div role="alert" className="drone-warning">
            <p>
              The plan changed from revision {draft.sourceRevision} to {mission.revision}. Check the source, findings
              and validity against the current plan.
            </p>
            <button type="button" onClick={draft.confirmRevision}>
              I reviewed this draft against the current plan
            </button>
          </div>
        )}
        <div className="drone-fields">
          <label>
            Check type
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              {EVIDENCE_KINDS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Result
            <select value={form.result} onChange={(e) => set("result", e.target.value)}>
              <option value="reviewed">Reviewed — requirements resolved</option>
              <option value="action_required">Action required</option>
              <option value="awaiting_permission">Awaiting permission</option>
            </select>
          </label>
          <p className="drone-wide drone-note">{EVIDENCE_KINDS.find(([id]) => id === form.kind)?.[2]}</p>
          <label>
            Source / briefing reference
            <input value={form.source} onChange={(e) => set("source", e.target.value)} />
          </label>
          <label>
            Reviewer
            <input value={form.reviewer} onChange={(e) => set("reviewer", e.target.value)} />
          </label>
          <label>
            Checked at (UTC)
            <input type="datetime-local" value={form.checkedAt} onChange={(e) => set("checkedAt", e.target.value)} />
          </label>
          <label>
            Valid until (UTC)
            <input type="datetime-local" value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
          </label>
          <label className="drone-wide">
            Findings, coverage, conditions, contacts and required actions
            <textarea
              aria-label="Findings, coverage, conditions, contacts and required actions"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
          <label className="drone-wide">
            Evidence in Document Library
            <select value={form.documentId} onChange={(e) => set("documentId", e.target.value)}>
              <option value="">No linked file — include a retrievable source reference above</option>
              {documents.map((d) => (
                <option key={d.id || d.key} value={d.id || d.key}>
                  {d.name || d.key}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" disabled={draft.revisionChanged} onClick={save} style={{ marginTop: 16 }}>
          Save check evidence
        </button>
        {draft.dirty && (
          <button
            type="button"
            onClick={() => {
              draft.reset();
              setError("");
            }}
          >
            Discard evidence draft
          </button>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="drone-error">
          {error}
        </p>
      )}
      {(mission.evidence || []).map((e) => (
        <div className="drone-evidence" key={e.id}>
          <strong>
            {EVIDENCE_KINDS.find(([id]) => id === e.kind)?.[1]} · {e.result.replaceAll("_", " ")}
          </strong>
          <p>{e.note}</p>
          <small>
            {e.source} · {e.reviewer} · checked {e.checkedAt} · valid until {e.validUntil} · revision{" "}
            {e.missionRevision}
          </small>
        </div>
      ))}
    </section>
  );
}
