import { AlertTriangle, Archive, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Download, ListTodo, Plus, Presentation, Trash2 } from "lucide-react";

import { jobTone, readinessForJob } from "../../utils/managementOverview";
import { dateLabel, formatShortMonth, plural, scheduleLabel } from "./format";
import { ReadinessRing } from "./ui";

/**
 * Meeting mode: a stepped agenda over the same live data, an action register, and the
 * archive of previously closed minutes.
 */
export default function MeetingTab({
  meeting,
  meetings,
  agenda,
  step,
  setStep,
  briefingParts,
  attentionJobs,
  completedJobs,
  scheduledJobs,
  capacityRows,
  capacityMonths,
  sortedActions,
  newAction,
  setNewAction,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
  onUpdateMeeting,
  onArchive,
  onDeleteArchived,
  onExportPack,
  exportBusy,
  todayIso,
  today,
  teamName,
  onSelectJob,
}) {
  return (
    <section className="mgo-meeting">
      <header className="mgo-meeting__hero">
        <div><span className="mgo-eyebrow"><Presentation size={12} /> Private meeting workspace</span><input className="mgo-meeting__title" value={meeting.title} maxLength={100} onChange={(e) => onUpdateMeeting({ title: e.target.value })} aria-label="Meeting title" /><label>Attendees<input value={meeting.attendees} maxLength={500} onChange={(e) => onUpdateMeeting({ attendees: e.target.value })} placeholder="e.g. Operations Director, H&S Manager, Contracts Manager" /></label></div>
        <div className="mgo-meeting__hero-actions"><span><i />Live management record</span><div className="mgo-meeting__hero-buttons"><button type="button" className="mgo-btn mgo-btn--ghost" onClick={onArchive}><Archive size={14} />Close &amp; archive</button><button type="button" className="mgo-btn mgo-btn--ghost" onClick={onExportPack} disabled={exportBusy}><Download size={14} />Export meeting pack</button></div></div>
      </header>
      <div className="mgo-meeting__layout">
        <nav className="mgo-meeting__agenda" aria-label="Meeting agenda">
          <span>Meeting agenda</span>
          {agenda.map((item, index) => <button type="button" key={item.label} className={step === index ? "is-active" : ""} onClick={() => setStep(index)}><b>{index + 1}</b><span><strong>{item.label}</strong><small>{item.value}</small></span><ChevronRight size={14} /></button>)}
          <div className="mgo-meeting__progress"><span><i style={{ width: `${((step + 1) / agenda.length) * 100}%` }} /></span><small>Agenda {step + 1} of {agenda.length}</small></div>
        </nav>
        <div className="mgo-meeting__stage">
          <div className="mgo-meeting__stage-head"><div><span className="mgo-eyebrow">Agenda item {step + 1}</span><h2>{agenda[step].label}</h2><p>{agenda[step].detail}</p></div><strong>{agenda[step].value}</strong></div>

          {step === 0 ? <div className="mgo-meeting__brief"><div className="mgo-meeting__big-number"><strong>{attentionJobs.length}</strong><span>jobs require management attention</span></div><div><h3>Today’s operational briefing</h3><p>{briefingParts.join(" ")}</p><button type="button" onClick={() => setStep(4)}>Review decisions <ArrowRight size={14} /></button></div></div> : null}

          {step === 1 ? <div className="mgo-meeting__job-list">{completedJobs.length ? completedJobs.map((job) => <button type="button" key={job.id} onClick={() => onSelectJob(job.id)}><CheckCircle2 size={17} /><span><strong>{job.name}</strong><small>{job.client} · completed {dateLabel(job.end)}</small></span><ChevronRight size={14} /></button>) : <div className="mgo-empty"><CheckCircle2 size={25} /><strong>No completed work recorded</strong><span>Mark completed jobs to include them in the four-week review.</span></div>}</div> : null}

          {step === 2 ? <div className="mgo-meeting__job-list">{scheduledJobs.slice(0, 12).map((job) => <button type="button" key={job.id} onClick={() => onSelectJob(job.id)}><span className={`mgo-meeting__dot mgo-meeting__dot--${jobTone(job)}`} /><span><strong>{job.name}</strong><small>{teamName(job.teamId)} · {dateLabel(job.start)} to {dateLabel(job.end)}</small></span><ReadinessRing value={readinessForJob(job)} size="small" /></button>)}{!scheduledJobs.length ? <div className="mgo-empty"><CalendarDays size={25} /><strong>No upcoming work</strong><span>Add project dates to populate this agenda item.</span></div> : null}</div> : null}

          {step === 3 ? <div className="mgo-meeting__capacity">{capacityRows.map(({ team, values }) => <article key={team.id}><header><i style={{ background: team.colour }} /><strong>{team.name}</strong><small>{team.region || "No region"}</small></header>{values.map((value, index) => <div key={index}><span>{formatShortMonth(capacityMonths[index])}<b className={value.percentage > 100 ? "is-over" : value.percentage < 60 ? "is-gap" : ""}>{value.percentage}%</b></span><em><i style={{ width: `${Math.min(100, value.percentage)}%` }} /></em></div>)}</article>)}</div> : null}

          {step === 4 ? <div className="mgo-meeting__job-list">{attentionJobs.slice(0, 12).map((job) => <button type="button" key={job.id} onClick={() => onSelectJob(job.id)}><AlertTriangle size={17} /><span><strong>{job.name}</strong><small>{job.teamId ? teamName(job.teamId) : "No team assigned"} · {scheduleLabel(job, today)} · {readinessForJob(job)}% ready</small></span><span className={`mgo-status mgo-status--${jobTone(job)}`}>{job.status}</span></button>)}{!attentionJobs.length ? <div className="mgo-empty"><CheckCircle2 size={25} /><strong>No decisions required</strong><span>All active jobs are currently ready.</span></div> : null}</div> : null}

          {step === 5 ? <div className="mgo-actions"><form onSubmit={onAddAction}><label>Decision or action<input autoFocus value={newAction.text} maxLength={300} onChange={(e) => setNewAction((action) => ({ ...action, text: e.target.value }))} placeholder="e.g. Confirm North Team for Manchester" required /></label><label>Owner<input value={newAction.owner} maxLength={80} onChange={(e) => setNewAction((action) => ({ ...action, owner: e.target.value }))} placeholder="Name" /></label><label>Due date<input type="date" value={newAction.due} onChange={(e) => setNewAction((action) => ({ ...action, due: e.target.value }))} /></label><button className="mgo-btn mgo-btn--primary"><Plus size={14} />Add action</button></form><div className="mgo-actions__list">{sortedActions.map((action) => { const isOverdue = action.status !== "Done" && action.due && action.due < todayIso; return <article key={action.id} className={`${action.status === "Done" ? "is-done" : ""} ${isOverdue ? "is-overdue" : ""}`}><button type="button" aria-label={action.status === "Done" ? "Reopen action" : "Complete action"} onClick={() => onUpdateAction(action.id, { status: action.status === "Done" ? "Open" : "Done" })}><CheckCircle2 size={17} /></button><span><strong>{action.text}</strong><small>{action.owner || "Unassigned"} · due {dateLabel(action.due)}{isOverdue ? <em className="mgo-chip mgo-chip--red">Overdue</em> : null}</small></span><select value={action.status} onChange={(e) => onUpdateAction(action.id, { status: e.target.value })} aria-label={`Status for ${action.text}`}><option>Open</option><option>In progress</option><option>Done</option></select><button type="button" aria-label="Remove action" onClick={() => onRemoveAction(action.id)}><Trash2 size={14} /></button></article>; })}{!meeting.actions.length ? <div className="mgo-empty"><ListTodo size={25} /><strong>No actions recorded</strong><span>Add decisions during the meeting. They will appear in the Board Pack.</span></div> : null}</div></div> : null}

          <label className="mgo-meeting__notes">Management notes<textarea value={meeting.notes} maxLength={5000} onChange={(e) => onUpdateMeeting({ notes: e.target.value })} placeholder="Record context, decisions and follow-up notes for the Board Pack..." /></label>
          <footer className="mgo-meeting__stage-nav"><button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Previous</button><span>Changes save automatically</span><button type="button" disabled={step === agenda.length - 1} onClick={() => setStep((current) => Math.min(agenda.length - 1, current + 1))}>Next agenda item <ChevronRight size={13} /></button></footer>

          {meetings.length ? (
            <section className="mgo-meeting-archive" aria-labelledby="mgo-archive-title">
              <h3 id="mgo-archive-title"><Archive size={14} /> Meeting history ({meetings.length})</h3>
              <p>Closed minutes stay here. Open actions were carried into the current meeting when each one was archived.</p>
              {meetings.map((row) => {
                const open = row.actions.filter((action) => action.status !== "Done").length;
                return (
                  <details key={row.id}>
                    <summary>
                      <strong>{row.title}</strong>
                      <small>{dateLabel(row.closedOn)} · {row.actions.length} {plural(row.actions.length, "action")}{open ? ` · ${open} open at close` : ""}</small>
                    </summary>
                    {row.attendees ? <p className="mgo-meeting-archive__attendees">{row.attendees}</p> : null}
                    {row.notes ? <p className="mgo-meeting-archive__notes">{row.notes}</p> : null}
                    {row.actions.length ? (
                      <ul>
                        {row.actions.map((action) => (
                          <li key={action.id} className={action.status === "Done" ? "is-done" : ""}>
                            <span>{action.text}</span>
                            <small>{action.owner || "Unassigned"} · {action.status}</small>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <button type="button" className="mgo-btn mgo-btn--danger" onClick={() => onDeleteArchived(row.id)}><Trash2 size={13} /> Delete these minutes</button>
                  </details>
                );
              })}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
