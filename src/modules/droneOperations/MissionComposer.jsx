import { projectDisplayLabel } from "../../utils/projectDisplayLabel";
import { useState } from "react";
import { WORK_CONTEXTS, documentOutline, projectSuggestions } from "./documentAutomation.js";
import { AU_TIME_ZONES } from "./droneRegions.js";
import { preparationError, repeatMissionDefaults, scheduledEnd } from "./missionPreparation.js";

export default function MissionComposer({
  regionCode,
  projects,
  templates,
  missions = [],
  onCreate,
  onCancel,
  canEdit,
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(120);
  const [draft, setDraft] = useState({
    projectId: "",
    aircraftKind: regionCode === "au" ? "helicopter" : "drone",
    templateId: "topo",
    timeZone: regionCode === "au" ? "" : "Europe/London",
    workContexts: [],
    start: "",
    end: "",
    sourceMissionId: "",
    sourceVersion: "",
  });
  const set = (key, value) => {
    setError("");
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(["projectId", "aircraftKind"].includes(key) ? { sourceMissionId: "", sourceVersion: "" } : {}),
    }));
  };
  const schedule = (changes, minutes = duration) => {
    const next = { ...draft, ...changes };
    setError("");
    if (minutes && next.start) {
      try {
        next.end = scheduledEnd({ ...next, regionCode }, minutes);
      } catch (e) {
        next.end = "";
        setError(e.message);
      }
    } else if (minutes && !next.start) next.end = "";
    setDraft(next);
  };
  const previous = missions
    .filter(
      (m) =>
        m.projectId === draft.projectId &&
        (m.regionCode || "uk") === regionCode &&
        (m.aircraftKind || "drone") === draft.aircraftKind &&
        !m.cancelled &&
        !m.deletedAt
    )
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const source = previous.find((m) => m.id === draft.sourceMissionId);
  const project = projects.find((p) => p.id === draft.projectId && !p.deletedAt);
  const template = templates.find((t) => t.id === draft.templateId);
  const reused = source ? repeatMissionDefaults(source) : {};
  if (source && source.templateId !== draft.templateId) {
    reused.qa = "";
    reused.deliverables = "";
  }
  const suggestions = projectSuggestions(reused, project, template);
  return (
    <section className="document-composer" aria-label="Mission preparation">
      <div className="document-composer-main">
        <div className="document-heading">
          <div>
            <h2>From project to prepared package.</h2>
            <p>Start with what you already know. Review the details that make this operation different.</p>
          </div>
          <button onClick={onCancel}>Close preparation</button>
        </div>
        <ol className="document-steps" aria-label="Preparation steps">
          {["Project & aircraft", "Survey & conditions", "Package preview"].map((label, i) => (
            <li key={label} aria-current={step === i ? "step" : undefined}>
              <span>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canEdit) return;
            const problem = preparationError({ ...draft, regionCode });
            if (!project || !template || problem || (draft.sourceMissionId && !source)) {
              setError(problem || "Choose an available project, survey template and previous mission.");
              setStep(0);
              return;
            }
            if (step < 2) setStep(step + 1);
            else onCreate(draft);
          }}
        >
          <fieldset disabled={!canEdit}>
            {step === 0 && (
              <div className="drone-fields">
                <label className="drone-wide">
                  Project for this mission
                  <select required value={draft.projectId} onChange={(e) => set("projectId", e.target.value)}>
                    <option value="">Choose an existing project</option>
                    {projects
                      .filter((p) => !p.deletedAt)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {projectDisplayLabel(p)}
                        </option>
                      ))}
                  </select>
                </label>
                {!projects.length && <p>Create a project in the existing Projects register first.</p>}
                <label>
                  Survey aircraft
                  <select value={draft.aircraftKind} onChange={(e) => set("aircraftKind", e.target.value)}>
                    <option value="drone">Drone / RPAS</option>
                    {regionCode === "au" && <option value="helicopter">Crewed helicopter</option>}
                  </select>
                </label>
                <label>
                  Local operation time zone
                  <select required value={draft.timeZone} onChange={(e) => schedule({ timeZone: e.target.value })}>
                    <option value="">Choose the operation location</option>
                    {(regionCode === "au" ? AU_TIME_ZONES : ["Europe/London"]).map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                </label>
                {previous.length > 0 && (
                  <label className="drone-wide">
                    Reuse a previous mission (optional)
                    <select
                      value={draft.sourceMissionId}
                      onChange={(e) => {
                        const selected = previous.find((m) => m.id === e.target.value);
                        schedule({
                          sourceMissionId: selected?.id || "",
                          sourceVersion: selected
                            ? selected.editToken || selected.updatedAt || String(selected.revision)
                            : "",
                          ...(selected
                            ? {
                                templateId: templates.some((t) => t.id === selected.templateId)
                                  ? selected.templateId
                                  : draft.templateId,
                                workContexts: [...(selected.workContexts || [])],
                                timeZone: selected.timeZone || draft.timeZone,
                              }
                            : {}),
                        });
                      }}
                    >
                      <option value="">Start from project and default setup</option>
                      {previous.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title || "Untitled mission"}
                        </option>
                      ))}
                    </select>
                    <small>
                      Reuses crew, equipment, map geometry and planning details. Review them for this operation; checks
                      and approvals start empty.
                    </small>
                  </label>
                )}
                <label>
                  Planned start (local, optional)
                  <input
                    type="datetime-local"
                    value={draft.start}
                    onChange={(e) => schedule({ start: e.target.value })}
                  />
                </label>
                <label>
                  Planned end (local, optional)
                  <input
                    type="datetime-local"
                    value={draft.end}
                    onChange={(e) => {
                      setDuration(0);
                      set("end", e.target.value);
                    }}
                  />
                </label>
                <label className="drone-wide">
                  Planned duration
                  <select
                    value={duration}
                    onChange={(e) => {
                      const minutes = Number(e.target.value);
                      setDuration(minutes);
                      schedule({}, minutes);
                    }}
                  >
                    <option value={0}>Enter end time manually</option>
                    {[30, 60, 120, 240, 480].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hours`}
                      </option>
                    ))}
                  </select>
                  <small>
                    End time follows the start and operation time zone. Leave both dates blank for an undated draft.
                  </small>
                </label>
              </div>
            )}
            {step === 1 && (
              <>
                <label>
                  Survey deliverable
                  <select value={draft.templateId} onChange={(e) => set("templateId", e.target.value)}>
                    {templates.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <h3>What needs extra planning?</h3>
                <p>Select every condition that applies. Each adds a focused review to your package.</p>
                <div className="document-context-options">
                  {WORK_CONTEXTS.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={draft.workContexts.includes(c.id)}
                        onChange={(e) =>
                          set(
                            "workContexts",
                            e.target.checked
                              ? [...draft.workContexts, c.id]
                              : draft.workContexts.filter((id) => id !== c.id)
                          )
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <div className="document-preview-summary">
                <h3>{project?.name}</h3>
                {source && (
                  <p>
                    Planning details from <strong>{source.title}</strong>. Weather, limits confirmation, evidence, field
                    records and approvals will be reset.
                  </p>
                )}
                <p>
                  {draft.aircraftKind === "helicopter" ? "Helicopter survey coordination" : "Drone survey preparation"}{" "}
                  · {draft.timeZone}
                </p>
                <dl>
                  {suggestions.map((s) => (
                    <div key={s.field}>
                      <dt>{s.field === "qa" ? "Survey QA" : s.field}</dt>
                      <dd>
                        {s.value}
                        <small>{s.source}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  Creates a draft with {suggestions.length} reused fields. Permissions, evidence and checks remain open
                  for review.
                </p>
              </div>
            )}
            <div className="document-step-actions">
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)}>
                  Back
                </button>
              )}
              <button className="drone-primary" type="submit">
                {["Continue", "Preview package", "Create prepared mission"][step]}
              </button>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="drone-note">
              {error}
            </p>
          )}
        </form>
      </div>
      <aside className="document-paper" aria-label="Package contents preview">
        <span className="document-paper-mark">MySafeOps / {regionCode.toUpperCase()}</span>
        <h3>{project?.name || "Your next survey"}</h3>
        <p>{template?.name || "Survey package"}</p>
        <ol>
          {documentOutline(draft).map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ol>
        <div className="document-paper-note">
          One set of mission details.
          <br />
          Consistent documents throughout.
        </div>
      </aside>
    </section>
  );
}
