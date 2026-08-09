import { AlertTriangle, ArrowRight, GitCompareArrows, LockKeyhole, ShieldCheck } from "lucide-react";

import { readinessForJob } from "../../utils/managementOverview";
import { dateLabel, formatShortMonth, plural } from "./format";
import { ReadinessRing } from "./ui";

/** "What if we move this job?" — a sandbox that never touches the live programme until applied. */
export default function ScenarioTab({ jobs, teams, draft, setDraft, selectJob, job, team, conflicts, capacityBefore, capacityAfter, capacityMonths, onApply, teamName }) {
  return (
    <section className="mgo-scenario">
      <header className="mgo-scenario__hero">
        <div><span className="mgo-eyebrow">Safe planning sandbox</span><h2>What if we move this job?</h2><p>Test dates and team allocation without changing the live programme. Nothing is saved until you apply the scenario.</p></div>
        <span><GitCompareArrows size={22} /> Draft scenario</span>
      </header>
      <div className="mgo-scenario__layout">
        <section className="mgo-panel mgo-scenario__controls">
          <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Proposed change</span><h2>Build scenario</h2></div></div>
          <label>Project or opportunity<select value={draft.jobId} onChange={(event) => selectJob(event.target.value)}><option value="">Select work</option>{jobs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <div className="mgo-scenario__form-grid">
            <label>Proposed team<select value={draft.teamId} onChange={(event) => setDraft((current) => ({ ...current, teamId: event.target.value }))}><option value="">Unassigned</option>{teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label>Start date<input type="date" value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} /></label>
            <label>Finish date<input type="date" min={draft.start} value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} /></label>
          </div>
          {job ? <div className="mgo-scenario__current"><span>Current programme</span><strong>{teamName(job.teamId)}</strong><small>{dateLabel(job.start)} to {dateLabel(job.end)}</small></div> : null}
          <div className="mgo-scenario__actions"><button type="button" className="mgo-btn mgo-btn--ghost" onClick={() => job && selectJob(job.id)}>Reset</button><button type="button" className="mgo-btn mgo-btn--primary" disabled={!job || !draft.start || !draft.end || draft.end < draft.start} onClick={onApply}>Apply to programme <ArrowRight size={14} /></button></div>
        </section>

        <section className="mgo-panel mgo-scenario__impact">
          <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Instant impact analysis</span><h2>{job ? job.name : "Select work to begin"}</h2><p>{team ? `Proposed allocation to ${team.name}` : "Choose a team to calculate capacity and conflicts."}</p></div>{job ? <ReadinessRing value={readinessForJob(job)} size="small" /> : null}</div>
          <div className={`mgo-scenario__verdict ${conflicts.length ? "is-warning" : "is-clear"}`}><span>{conflicts.length ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}</span><div><strong>{conflicts.length ? `${conflicts.length} scheduling ${plural(conflicts.length, "conflict")} detected` : "No scheduling conflict detected"}</strong><small>{conflicts.length ? conflicts.map((row) => row.name).join(", ") : "The proposed team has no overlapping jobs in this period."}</small></div></div>
          <div className="mgo-scenario__capacity">
            <div className="mgo-scenario__capacity-head"><span>Proposed team capacity</span><small>Before → after</small></div>
            {capacityMonths.map((month, index) => { const before = capacityBefore[index]?.percentage || 0; const after = capacityAfter[index]?.percentage || 0; return <article key={month.toISOString()}><span><strong>{formatShortMonth(month)}</strong><small>{before}%</small><ArrowRight size={12} /><b className={after > 100 ? "is-over" : after < 60 ? "is-gap" : ""}>{after}%</b></span><em><i style={{ width: `${Math.min(100, after)}%` }} /></em></article>; })}
          </div>
          <div className="mgo-scenario__notice"><LockKeyhole size={14} /><span><strong>Simulation only</strong><small>Your live planner remains unchanged until “Apply to programme” is selected.</small></span></div>
        </section>
      </div>
    </section>
  );
}
