import { useEffect, useRef, useState } from "react";
import {
  WORK_CONTEXTS,
  documentOutline,
  projectSuggestions,
  preparationPatch,
  extractCandidates,
  acceptCandidate,
  acceptCandidates,
  extractExpiryCandidates,
  reuseConflicts,
  resolveReuseConflict,
  valueAt,
} from "./documentAutomation.js";
import { isHelicopter } from "./droneRegions.js";
import { actionSection } from "./droneReminders.js";

const fieldLabel = (field) =>
  ({ qa: "Survey QA", deliverables: "Deliverables", location: "Location", client: "Client", postcode: "Postcode" })[
    field
  ] || field;
export default function DocumentWorkbench({
  mission,
  context,
  template,
  actor,
  canEdit,
  onPatch,
  onSave,
  onExport,
  onNavigate,
  busy,
  actions,
}) {
  const [source, setSource] = useState(null),
    [reading, setReading] = useState(false),
    [error, setError] = useState(""),
    [reviewed, setReviewed] = useState({});
  const alive = useRef(true),
    request = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const project = context.projects.find((p) => p.id === mission.projectId);
  const suggestions = projectSuggestions(mission, project, template);
  const candidates = source ? extractCandidates(source.pages, isHelicopter(mission) ? "helicopter" : "drone") : [];
  const contexts = Array.isArray(mission.workContexts) ? mission.workContexts : [];
  const conflicts = reuseConflicts(mission, context);
  const expiryCandidates = source ? extractExpiryCandidates(source.pages) : [];
  const isApplied = (candidate) =>
    mission.sourceFacts?.some(
      (f) =>
        f.field === candidate.field &&
        f.value === candidate.value &&
        f.hash === source.hash &&
        f.expiresOn === source.expiresOn &&
        valueAt(mission, candidate.field) === candidate.value &&
        JSON.stringify(f.expiryEvidence || null) === JSON.stringify(source.expiryEvidence || null)
    );
  const selected = candidates.filter((candidate, index) => reviewed[index] && !isApplied(candidate));
  function applyReviewed() {
    try {
      if (
        onPatch(
          acceptCandidates(
            mission,
            source,
            selected.map((c) => ({ ...c, locationUnit: source.locationUnit })),
            actor.name
          )
        )
      )
        setReviewed({});
    } catch (e) {
      setError(e.message);
    }
  }
  function resolve(field, decision) {
    try {
      onPatch(resolveReuseConflict(mission, field, decision, context, actor.name));
    } catch (e) {
      setError(e.message);
    }
  }
  async function read(file) {
    if (!file) return;
    const token = ++request.current;
    setReading(true);
    setSource(null);
    setReviewed({});
    setError("");
    try {
      const { readSourceDocument } = await import("./documentImport.js");
      const result = await readSourceDocument(file);
      if (alive.current && token === request.current) setSource(result);
    } catch (e) {
      if (alive.current && token === request.current) setError(e.message);
    } finally {
      if (alive.current && token === request.current) setReading(false);
    }
  }
  function apply(candidate) {
    try {
      onPatch(acceptCandidate(mission, source, candidate, actor.name));
    } catch (e) {
      setError(e.message);
    }
  }
  const updateCheck = (id, changes) =>
    onSave({
      ...mission,
      approval: null,
      checklist: { ...mission.checklist, [id]: { ...mission.checklist?.[id], ...changes } },
      updatedAt: new Date().toISOString(),
    });
  return (
    <section className="document-workbench" aria-label="Document preparation workspace">
      <div className="document-desk-header">
        <div>
          <h2>Your document workspace</h2>
          <p>{mission.title}. Reuse trusted records, resolve the gaps and prepare a consistent package.</p>
        </div>
        <button className="drone-primary" onClick={() => onNavigate("review")}>
          Go to final review
        </button>
      </div>
      <nav className="document-action-strip" aria-label="Outstanding preparation actions">
        {Object.entries({
          overview: "Mission & map",
          setup: "Aircraft & crew",
          documents: "Documents",
          checks: "Evidence",
          checklist: "Checklist",
          review: "Final review",
        }).map(([section, label]) => {
          const count = actions.filter((a) => actionSection(a.key) === section).length;
          return (
            count > 0 && (
              <button key={section} onClick={() => onNavigate(section)}>
                {label}
                <strong>{count} open</strong>
              </button>
            )
          );
        })}
      </nav>
      <div className="document-desk-grid">
        <div className="document-desk-main">
          <section className="document-panel">
            <div className="document-heading">
              <div>
                <h3>Reuse what is already recorded</h3>
                <p>Only empty fields are filled. You can edit the result in the mission.</p>
              </div>
              <button
                disabled={!canEdit || !suggestions.length || busy}
                onClick={() => onPatch(preparationPatch(mission, suggestions, actor.name))}
              >
                Fill {suggestions.length} empty fields
              </button>
            </div>
            {suggestions.map((s) => (
              <div className="document-source-row" key={s.field}>
                <strong>{fieldLabel(s.field)}</strong>
                <span>
                  {s.value}
                  <small>{s.source}</small>
                </span>
              </div>
            ))}
            {!suggestions.length && (
              <p className="document-state">Available project and template fields are already filled.</p>
            )}
            {conflicts.map((c) => (
              <article
                className="document-candidate"
                key={c.field}
                aria-label={`${fieldLabel(c.field)} source difference`}
              >
                <h4>{fieldLabel(c.field)} source changed</h4>
                <p>Saved value: {c.previous}</p>
                <p>
                  Current source: {c.available ? c.value : "Unavailable"}
                  <small>{c.source}</small>
                </p>
                <div className="document-choice-actions">
                  <button disabled={!canEdit || busy || !c.available} onClick={() => resolve(c.field, "update")}>
                    Use current source value
                  </button>
                  <button disabled={!canEdit || busy} onClick={() => resolve(c.field, "manual")}>
                    Keep as manual value
                  </button>
                </div>
              </article>
            ))}
            {Object.entries(mission.fieldOrigins || {}).length > 0 && (
              <details>
                <summary>Where the reused values came from</summary>
                {Object.entries(mission.fieldOrigins).map(([field, origin]) => (
                  <div key={field} className="document-source-row">
                    <strong>{fieldLabel(field)}</strong>
                    <span>
                      {mission[field]}
                      <small>{origin.source}</small>
                      <small>
                        {mission[field] === origin.value
                          ? "Copied from the named record; confirm it is current."
                          : "Edited after reuse; current value differs from the source."}
                      </small>
                    </span>
                  </div>
                ))}
              </details>
            )}
          </section>
          <section className="document-panel">
            <h3>Working conditions</h3>
            <p>Select the conditions that apply, then record the arrangements for this site.</p>
            <fieldset disabled={!canEdit || busy}>
              <details>
                <summary>Choose working conditions · {contexts.length} selected</summary>
                <div className="document-context-options">
                  {WORK_CONTEXTS.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={contexts.includes(c.id)}
                        onChange={(e) =>
                          onPatch({
                            workContexts: e.target.checked ? [...contexts, c.id] : contexts.filter((id) => id !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </details>
              {WORK_CONTEXTS.filter((c) => contexts.includes(c.id)).map((c) => {
                const id = `context-${c.id}`,
                  check = mission.checklist?.[id];
                return (
                  <details className="document-context-review" key={c.id} open>
                    <summary>
                      {c.name}
                      <span>{check?.status === "done" ? "Review recorded" : "Review needed"}</span>
                    </summary>
                    <p>{c.prompt}</p>
                    <label>
                      {c.name} arrangements
                      <textarea
                        value={check?.note || ""}
                        onChange={(e) =>
                          updateCheck(id, { note: e.target.value, status: "pending", at: null, by: null })
                        }
                      />
                    </label>
                    <button
                      disabled={!check?.note?.trim()}
                      onClick={() => updateCheck(id, { status: "done", by: actor.name, at: new Date().toISOString() })}
                    >
                      Record {c.name} review
                    </button>
                    {check?.status === "done" && (
                      <small>
                        Recorded by {check.by} · {check.at}
                      </small>
                    )}
                  </details>
                );
              })}
              {contexts.some((id) => !WORK_CONTEXTS.some((c) => c.id === id)) && (
                <p className="drone-error">
                  Unsupported condition recorded.{" "}
                  <button
                    onClick={() =>
                      onPatch({ workContexts: contexts.filter((id) => WORK_CONTEXTS.some((c) => c.id === id)) })
                    }
                  >
                    Remove unsupported conditions
                  </button>
                </p>
              )}
            </fieldset>
          </section>
          <section className="document-panel">
            <h3>Read a source document</h3>
            <p>
              Extract labelled operator or aircraft fields from PDF, DOCX or TXT. Files are read locally; applying a
              value records its source, not an operational approval.
            </p>
            <label className="document-drop">
              Import source document
              <input
                type="file"
                aria-label="Import source document"
                accept=".pdf,.docx,.txt"
                disabled={!canEdit || reading || busy}
                onChange={(e) => {
                  read(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <small>
                Up to 8 MB / 40 PDF pages. Text extraction only; scanned images need transcription. Keep the original in
                your Document Library.
              </small>
            </label>
            {reading && <p role="status">Reading document text…</p>}
            {error && (
              <p className="drone-error" role="alert">
                {error}
              </p>
            )}
            {source && (
              <div className="document-import-result">
                <h4>{source.name}</h4>
                <p>{candidates.length} candidate field(s). Review each excerpt against the original before applying.</p>
                <label>
                  Document expiry (optional; verify in the source)
                  <input
                    type="date"
                    value={source.expiresOn}
                    onChange={(e) => {
                      setSource({ ...source, expiresOn: e.target.value, expiryEvidence: null });
                      setReviewed({});
                    }}
                  />
                </label>
                {expiryCandidates.map((e) => (
                  <div className="document-expiry-choice" key={e.date}>
                    <blockquote>{e.quote}</blockquote>
                    <small>
                      {source.locationUnit} {e.page} · Confirm this expiry applies to the fields you are using.
                    </small>
                    <button
                      disabled={!canEdit || busy}
                      onClick={() => {
                        setSource({ ...source, expiresOn: e.date, expiryEvidence: e });
                        setReviewed({});
                      }}
                    >
                      Use expiry {e.date}
                    </button>
                  </div>
                ))}
                {source.expiryEvidence && <p role="status">Selected expiry excerpt: {source.expiryEvidence.quote}</p>}
                {!source.hasText && (
                  <p className="drone-error">
                    No readable text was found. This may be a scanned document. Transcribe the relevant text into a TXT
                    file and identify the original source before importing.
                  </p>
                )}
                {source.hasText && !candidates.length && (
                  <p>
                    No supported labelled fields found. Read the text below and enter the information in Aircraft & crew
                    with the original document reference.
                  </p>
                )}
                {candidates.map((candidate, index) => {
                  const applied = isApplied(candidate);
                  const previous = valueAt(mission, candidate.field);
                  return (
                    <article
                      className="document-candidate"
                      key={`${candidate.field}-${index}`}
                      data-testid={`candidate-${candidate.field}`}
                    >
                      <h4>{candidate.label}</h4>
                      <strong>{candidate.value}</strong>
                      <blockquote>{candidate.quote}</blockquote>
                      <small>
                        {source.locationUnit} {candidate.page} · {source.name}
                      </small>
                      {previous && previous !== candidate.value && (
                        <p className="document-warning">Applying replaces the current value: {previous}</p>
                      )}
                      <label>
                        <input
                          type="checkbox"
                          checked={!!reviewed[index]}
                          onChange={(e) => setReviewed({ ...reviewed, [index]: e.target.checked })}
                          disabled={!canEdit || applied}
                        />
                        I checked this value against the source
                      </label>
                      <button
                        disabled={!canEdit || !reviewed[index] || applied || busy}
                        onClick={() => apply({ ...candidate, locationUnit: source.locationUnit })}
                      >
                        {applied ? "Applied to mission" : "Apply reviewed value"}
                      </button>
                    </article>
                  );
                })}
                {candidates.length > 1 && (
                  <button
                    className="drone-primary"
                    disabled={!canEdit || busy || !selected.length}
                    onClick={applyReviewed}
                  >
                    Apply {selected.length} reviewed values
                  </button>
                )}
                <details>
                  <summary>Extracted text and file fingerprint</summary>
                  <p className="document-hash">SHA-256: {source.hash}</p>
                  {source.pages.map((p) => (
                    <div key={p.page}>
                      <strong>
                        {source.locationUnit} {p.page}
                      </strong>
                      <pre>{p.text}</pre>
                    </div>
                  ))}
                </details>
              </div>
            )}
            {(mission.sourceFacts || []).map((fact, i) => (
              <div className="document-source-row" key={`${fact.field}-${i}`}>
                <strong>{fact.label || fact.field}</strong>
                <span>
                  <span>Source linked: {fact.sourceName}</span>
                  <small>
                    {fact.locationUnit || "Page"} {fact.page} · reviewed by {fact.by}
                  </small>
                  <small>
                    {fact.expiresOn
                      ? `Expiry recorded: ${fact.expiresOn}`
                      : "Expiry not recorded; check applicability."}
                  </small>
                </span>
                <button
                  disabled={!canEdit || busy}
                  onClick={() => onPatch({ sourceFacts: mission.sourceFacts.filter((_, index) => index !== i) })}
                >
                  Remove source link
                </button>
              </div>
            ))}
          </section>
        </div>
        <aside className="document-package-rail">
          <div className="document-paper">
            <span className="document-paper-mark">Package contents</span>
            <h3>{mission.title}</h3>
            <ol>
              {documentOutline(mission).map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ol>
            <div className="document-paper-note">
              Draft preparation
              <br />
              {actions.length} open action(s) before final review
            </div>
          </div>
          <div className="document-downloads">
            <h3>Draft documents</h3>
            <p>Built from this mission. Open actions stay visible in every export.</p>
            <button className="drone-primary" disabled={busy} onClick={() => onExport("bundle")}>
              Download all draft documents (ZIP)
            </button>
            {[
              ["field", "field card"],
              ["operator", "operator review"],
              ["task", "task plan"],
              ["briefing", "crew briefing"],
              ["sources", "evidence register"],
              ["closeout", "close-out record"],
            ].map(([kind, label]) => (
              <button key={kind} disabled={busy} onClick={() => onExport(kind)}>
                Download draft {label}
              </button>
            ))}
            <button disabled={busy} onClick={() => onExport()}>
              Download full draft package
            </button>
          </div>
          <div className="document-next">
            <h3>Continue preparation</h3>
            {[
              ["overview", "Check mission & map"],
              ["setup", "Check aircraft & crew"],
              ["checks", "Record checks & evidence"],
            ].map(([section, label]) => (
              <button key={section} onClick={() => onNavigate(section)}>
                {label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
