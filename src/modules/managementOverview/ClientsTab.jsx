import { AlertTriangle, Building2, ChevronRight, ShieldAlert, Timer } from "lucide-react";

import { jobTone, readinessForJob } from "../../utils/managementOverview";
import { dateLabel, plural } from "./format";

/** The programme seen from the customer side: who the work is for and where the value sits. */
export default function ClientsTab({ rows, summary, money, tracksValue, onSelectJob }) {
  if (!rows.length) {
    return (
      <section className="mgo-panel">
        <div className="mgo-empty">
          <Building2 size={25} />
          <strong>No clients yet</strong>
          <span>Clients appear here as soon as projects or pipeline opportunities name one.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="mgo-clients">
      <div className="mgo-panel__head">
        <div>
          <span className="mgo-eyebrow"><Building2 size={12} /> Client view</span>
          <h2>{summary.clients} {plural(summary.clients, "client")} on the programme</h2>
          <p>
            {summary.clientsWithWork} {plural(summary.clientsWithWork, "client has", "clients have")} work booked or running.
            {tracksValue && summary.topShare >= 40
              ? ` ${summary.topName} carries ${summary.topShare}% of the value — worth watching as a concentration risk.`
              : ""}
          </p>
        </div>
        {tracksValue ? <strong className="mgo-clients__total">{money(summary.totalValue)}</strong> : null}
      </div>

      <div className="mgo-clients__list">
        {rows.map((row) => (
          <details key={row.key} className="mgo-clients__card">
            <summary>
              <span className="mgo-clients__name">
                <strong>{row.name}</strong>
                <small>
                  {row.counts.total} {plural(row.counts.total, "job")}
                  {row.counts.pipeline ? ` · ${row.counts.pipeline} in pipeline` : ""}
                </small>
              </span>
              <span className="mgo-clients__signals">
                {row.counts.live ? <em className="mgo-chip mgo-chip--green"><Timer size={10} /> {row.counts.live} on site</em> : null}
                {row.counts.overdue ? <em className="mgo-chip mgo-chip--red">{row.counts.overdue} overdue</em> : null}
                {row.conflicts ? <em className="mgo-chip mgo-chip--red"><ShieldAlert size={10} /> {row.conflicts}</em> : null}
                {row.attention ? <em className="mgo-chip mgo-chip--amber"><AlertTriangle size={10} /> {row.attention}</em> : null}
              </span>
              <span className="mgo-clients__figures">
                {tracksValue ? <strong>{money(row.value.total)}</strong> : null}
                <small>{row.nextStart ? `Next ${dateLabel(row.nextStart)}` : "Nothing booked ahead"}</small>
              </span>
            </summary>

            {tracksValue ? (
              <dl className="mgo-clients__value">
                <div><dt>On site</dt><dd>{money(row.value.live)}</dd></div>
                <div><dt>Booked ahead</dt><dd>{money(row.value.scheduled)}</dd></div>
                <div><dt>Completed</dt><dd>{money(row.value.completed)}</dd></div>
                <div><dt>Pipeline</dt><dd>{money(row.value.pipeline)}</dd></div>
              </dl>
            ) : null}

            <ul className="mgo-clients__jobs">
              {row.jobs.map((job) => (
                <li key={job.id}>
                  <button type="button" onClick={() => onSelectJob(job.id)}>
                    <span className={`mgo-meeting__dot mgo-meeting__dot--${jobTone(job)}`} />
                    <span>
                      <strong>{job.name}</strong>
                      <small>{job.start ? `${dateLabel(job.start)} – ${dateLabel(job.end)}` : "No dates set"} · {readinessForJob(job)}% ready</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
