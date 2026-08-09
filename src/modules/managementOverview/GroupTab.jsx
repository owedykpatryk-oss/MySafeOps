import { BriefcaseBusiness, Globe2, RefreshCw, Users } from "lucide-react";

import { MetricCard } from "./ui";

/** Read-only consolidation across every country workspace the viewer can reach. */
export default function GroupTab({ rollup, error, busy, onRefresh }) {
  return (
    <section className="mgo-group" aria-label="All countries">
      <div className="mgo-panel__head">
        <div>
          <span className="mgo-eyebrow">Group view</span>
          <h2>All countries</h2>
        </div>
        <button type="button" className="mgo-btn mgo-btn--ghost" onClick={onRefresh} disabled={busy}>
          <RefreshCw size={13} /> {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="mgo-group__note">
        Read-only. Each country keeps its own plan; edit it by switching country in the top bar.
        Scheduled work is not rolled up here — job registers stay isolated per country.
      </p>
      {error ? (
        <div className="mgo-group__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>Try again</button>
        </div>
      ) : null}
      {busy && !rollup ? <div className="mgo-group__loading">Loading countries…</div> : null}
      {rollup ? (
        <>
          <section className="mgo-metrics" aria-label="Group summary">
            <MetricCard icon={Globe2} value={rollup.totals.countries} label="countries planning" detail={`${rollup.totals.capacity} total crew capacity`} />
            <MetricCard icon={Users} value={rollup.totals.teams} label="teams across the group" detail={`${rollup.totals.openActions} open actions`} />
            <MetricCard icon={BriefcaseBusiness} value={rollup.totals.opportunities} label="pipeline opportunities" detail="across every country you can access" />
          </section>
          <div className="mgo-group__grid">
            {rollup.countries.map((country) => (
              <article key={country.workspaceId} className="mgo-group__card">
                <h3>{country.countryName}</h3>
                <dl>
                  <div><dt>Teams</dt><dd>{country.teams}</dd></div>
                  <div><dt>Capacity</dt><dd>{country.capacity}</dd></div>
                  <div><dt>Pipeline</dt><dd>{country.opportunities}</dd></div>
                  <div><dt>Open actions</dt><dd>{country.openActions}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          {rollup.countriesWithoutPlan?.length ? (
            <p className="mgo-group__pending">
              No plan started yet in {rollup.countriesWithoutPlan.map((country) => country.countryName).join(", ")}.
            </p>
          ) : null}
          {rollup.opportunities.length ? (
            <div className="mgo-group__table-wrap">
              <table className="mgo-group__table">
                <caption>Pipeline across the group</caption>
                <thead><tr><th>Opportunity</th><th>Client</th><th>Country</th></tr></thead>
                <tbody>
                  {rollup.opportunities.map((opportunity) => (
                    <tr key={opportunity.id}>
                      <td>{opportunity.name || "Untitled"}</td>
                      <td>{opportunity.client || "—"}</td>
                      <td>{opportunity.countryName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
