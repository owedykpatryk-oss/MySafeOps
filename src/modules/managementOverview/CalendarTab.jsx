import { CalendarDays, ChevronRight, Download, Layers3, ShieldCheck } from "lucide-react";

import { addDays, readinessForJob } from "../../utils/managementOverview";
import { formatMonth, plural } from "./format";

/** Calendar hub: how the programme will look once a provider is connected, plus the ICS export. */
export default function CalendarTab({ calendar, teams, teamById, jobs, weeks, today, icsPreviewCount, ramsLabel, onUpdateCalendar, onExport, onConnect, onSelectJob }) {
  return (
    <div className="mgo-calendar-hub">
      <section className="mgo-calendar-connect">
        <div className="mgo-calendar-connect__copy">
          <span className="mgo-eyebrow">Calendar hub</span>
          <h2>Your programme, grouped under MySafeOps</h2>
          <p>Connect one provider and keep the management programme, team diaries and compliance deadlines together — without flooding anyone’s personal calendar.</p>
        </div>
        <div className="mgo-provider-grid">
          <article className="mgo-provider mgo-provider--microsoft">
            <span className="mgo-provider__mark" aria-hidden><i /><i /><i /><i /></span>
            <div><strong>Microsoft 365</strong><small>Outlook Calendar</small></div>
            <span className="mgo-provider__state">Ready to connect</span>
            <button type="button" onClick={() => onConnect("microsoft")}>Connect Outlook</button>
          </article>
          <article className="mgo-provider mgo-provider--google">
            <span className="mgo-provider__g" aria-hidden>G</span>
            <div><strong>Google Workspace</strong><small>Google Calendar</small></div>
            <span className="mgo-provider__state">Ready to connect</span>
            <button type="button" onClick={() => onConnect("google")}>Connect Google</button>
          </article>
        </div>
      </section>

      <div className="mgo-calendar-layout">
        <section className="mgo-panel mgo-calendar-preview">
          <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Calendar structure</span><h2>How it will appear</h2></div><span className="mgo-live-preview"><i /> Live preview</span></div>
          <div className="mgo-calendar-window">
            <div className="mgo-calendar-window__top"><div className="mgo-calendar-window__brand"><span>M</span><strong>{calendar.groupName || "MySafeOps"}</strong></div><div className="mgo-calendar-window__month"><button type="button" aria-label="Previous month" disabled>‹</button><strong>{formatMonth(today)}</strong><button type="button" aria-label="Next month" disabled>›</button></div><span>Week</span></div>
            <div className="mgo-calendar-window__body">
              <aside className="mgo-calendar-tree">
                <strong><Layers3 size={13} />{calendar.groupName || "MySafeOps"}<small>{(calendar.separateTeamCalendars ? teams.length : 0) + (calendar.includeCompliance ? 2 : 1)}</small></strong>
                <label><i style={{ background: "#0f766e" }} /><span>{calendar.managementCalendar || "Management programme"}</span><input type="checkbox" defaultChecked /></label>
                {calendar.separateTeamCalendars ? teams.map((team) => <label key={team.id}><i style={{ background: team.colour }} /><span>{team.name}</span><input type="checkbox" defaultChecked /></label>) : null}
                {calendar.includeCompliance ? <label><i style={{ background: "#c2410c" }} /><span>Compliance deadlines</span><input type="checkbox" defaultChecked /></label> : null}
              </aside>
              <div className="mgo-calendar-week">
                <div className="mgo-calendar-week__days">{["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => <span key={day}><small>{day}</small><b>{addDays(weeks[0].start, index).getDate()}</b></span>)}</div>
                <div className="mgo-calendar-week__grid">
                  {[0, 1, 2, 3, 4].map((day) => <i key={day} />)}
                  {jobs.slice(0, 3).map((job, index) => {
                    const team = teamById.get(job.teamId);
                    return <button type="button" key={job.id} onClick={() => onSelectJob(job.id)} style={{ "--event-colour": team?.colour || "#0f766e", gridColumn: `${(index % 3) + 1} / span ${index === 0 ? 2 : 1}`, gridRow: index + 1 }}><strong>{job.name}</strong><small>{team?.name || "Management"} · {readinessForJob(job)}% ready</small></button>;
                  })}
                  {!jobs.length ? <div className="mgo-calendar-week__empty"><CalendarDays size={20} /><span>Scheduled jobs will appear here automatically.</span></div> : null}
                </div>
              </div>
            </div>
          </div>
          <p className="mgo-calendar-preview__note"><ShieldCheck size={13} /> The Management programme remains private. Team calendars can be shared separately when you choose.</p>
        </section>

        <aside className="mgo-panel mgo-calendar-settings">
          <div className="mgo-panel__head"><div><span className="mgo-eyebrow">Editable setup</span><h2>Calendar rules</h2></div></div>
          <label>Calendar group name<input value={calendar.groupName} maxLength={60} onChange={(e) => onUpdateCalendar({ groupName: e.target.value })} /></label>
          <label>Management calendar<input value={calendar.managementCalendar} maxLength={60} onChange={(e) => onUpdateCalendar({ managementCalendar: e.target.value })} /></label>
          <div className="mgo-calendar-switches">
            <label><span><strong>Separate team calendars</strong><small>Each event is tagged and titled with its team</small></span><input type="checkbox" checked={calendar.separateTeamCalendars} onChange={(e) => onUpdateCalendar({ separateTeamCalendars: e.target.checked })} /></label>
            <label><span><strong>Show provisional work</strong><small>Pipeline and provisional jobs are exported as tentative</small></span><input type="checkbox" checked={calendar.includeProvisional} onChange={(e) => onUpdateCalendar({ includeProvisional: e.target.checked })} /></label>
            <label><span><strong>Document deadlines</strong><small>{ramsLabel}, permits and surveys due a week before mobilisation</small></span><input type="checkbox" checked={calendar.includeDeadlines} onChange={(e) => onUpdateCalendar({ includeDeadlines: e.target.checked })} /></label>
            <label><span><strong>Compliance calendar</strong><small>Open management actions with a due date</small></span><input type="checkbox" checked={calendar.includeCompliance} onChange={(e) => onUpdateCalendar({ includeCompliance: e.target.checked })} /></label>
          </div>
          <button type="button" className="mgo-calendar-download" onClick={onExport}><Download size={16} /><span><strong>Export MySafeOps calendar</strong><small>{icsPreviewCount} {plural(icsPreviewCount, "event")} with these settings · Outlook, Google and Apple</small></span><ChevronRight size={15} /></button>
        </aside>
      </div>
    </div>
  );
}
