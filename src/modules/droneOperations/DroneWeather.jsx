import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { appApiUrl } from "../../utils/appApiUrl.js";
import { getOrgId } from "../../utils/orgStorage.js";
import { getCachedActiveCountryWorkspace } from "../../utils/countryWorkspaces.js";
import { evaluateForecast, forecastRequest } from "./droneWeather.js";
import { forecastWindows } from "./droneWeatherAssessment.js";
import { missionWindow } from "./droneMission.js";
import { missionTimeZone, isHelicopter } from "./droneRegions.js";
import { weatherFreshness } from "./weatherFreshness.js";
import { weatherReadiness, matchingWeatherSetup } from "./weatherPlanning.js";
export default function DroneWeather({ mission, onChange, canEdit, offline, onNavigate, savedSetups = [] }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(mission.weatherAutoRefresh !== false);
  const [now, setNow] = useState(Date.now);
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);
  const latest = useRef(mission);
  latest.current = mission;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setAutoRefresh(mission.weatherAutoRefresh !== false);
    setMessage("");
    lastAttempt.current = 0;
  }, [mission.id, mission.weatherAutoRefresh]);
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setVisible(document.visibilityState === "visible");
    };
    const timer = globalThis.setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      globalThis.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const freshness = weatherFreshness(mission.weather, now);
  const forecastIsCurrent = freshness.current;
  const readiness = weatherReadiness(mission, now);
  const requestReady = readiness.ready;
  const savedSetup = matchingWeatherSetup(mission, savedSetups);
  const canRefresh =
    canEdit && !mission.approval && !mission.operatorRelease && !mission.cancelled && !mission.deletedAt;
  const result = evaluateForecast(mission.weather, mission.limits);
  let zone = "UTC";
  try {
    zone = missionTimeZone(mission);
  } catch {
    /* Date entry remains blocked until a zone is chosen. */
  }
  const london = (value) => new Date(value).toLocaleString("en-GB", { timeZone: zone });
  let window;
  try {
    window = missionWindow(mission);
  } catch {
    window = null;
  }
  const windows =
    window && freshness.current ? forecastWindows(mission.weather, mission.limits, window.start, window.end) : [];
  const displayHours = result.hours.length
    ? result.hours
    : (mission.weather?.points || []).flatMap((p, index) =>
        p.hours.map((h) => ({ ...h, point: index + 1, warnings: [result.status] }))
      );
  async function fetchForecast() {
    if (inFlight.current || !canEdit || offline || !weatherReadiness(mission).ready) return;
    inFlight.current = true;
    lastAttempt.current = Date.now();
    setBusy(true);
    setMessage("");
    const token = mission.editToken,
      id = mission.id;
    try {
      const request = forecastRequest(mission);
      const session = await supabase?.auth.getSession();
      if (!session?.data?.session?.access_token)
        throw new Error("Sign in to fetch the forecast. Manual weather evidence can still be recorded below.");
      const country = getCachedActiveCountryWorkspace();
      const response = await fetch(appApiUrl("/api/drone-weather"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}` },
        body: JSON.stringify({
          ...request,
          orgSlug: getOrgId(),
          dataKey: country?.id && !country.is_primary ? `country:${country.id}:main` : "main",
        }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (!response.ok || data.status !== "available")
        throw new Error(data.message || data.error || "Not checked — weather provider unavailable.");
      if (mounted.current && latest.current.id === id && latest.current.editToken === token) {
        if (!onChange({ weather: data }))
          throw new Error("Forecast received but could not be saved. Retry after resolving the storage warning.");
        setNow(Date.now());
      } else if (mounted.current && latest.current.id === id)
        setMessage("Mission changed during the request. Fetch the forecast again for the current version.");
    } catch (e) {
      if (mounted.current && latest.current.id === id) {
        setMessage(e.message);
        setAutoRefresh(false);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const fetchLatest = useRef(fetchForecast);
  fetchLatest.current = fetchForecast;
  useEffect(() => {
    if (
      autoRefresh &&
      requestReady &&
      canRefresh &&
      !offline &&
      !forecastIsCurrent &&
      !busy &&
      visible &&
      document.visibilityState === "visible" &&
      Date.now() - lastAttempt.current >= 60000
    )
      void fetchLatest.current();
  }, [autoRefresh, requestReady, canRefresh, offline, forecastIsCurrent, busy, now, visible]);
  useEffect(() => {
    if (!canRefresh) setAutoRefresh(false);
  }, [canRefresh]);
  return (
    <section className="drone-card">
      <h2>Weather and operating window</h2>
      {isHelicopter(mission) && (
        <p className="drone-note">
          Surface forecast for site preparation only. Obtain and record the operator/pilot aviation briefing separately;
          these values do not establish helicopter flight minima.
        </p>
      )}
      <p>
        Hourly forecast at representative points. Wind and gusts refer to 10 m above ground, not measured conditions at
        flight height.
      </p>
      {!requestReady && (
        <div className="drone-note" role="status">
          <p>{readiness.message}</p>
          {onNavigate && readiness.action && (
            <button type="button" onClick={() => onNavigate("overview")}>
              {readiness.action === "map" ? "Set flight area on map" : "Set operation date and time"}
            </button>
          )}
        </div>
      )}
      {savedSetup && canRefresh && (
        <div className="drone-note">
          <button type="button" onClick={() => onChange({ limits: { ...savedSetup.limits, confirmed: false } })}>
            Use saved equipment limits
          </button>
          <p>
            {savedSetup.name || "Saved aircraft configuration"}. Check the values for this operation, then confirm
            below.
          </p>
        </div>
      )}
      <fieldset disabled={!canEdit}>
        <div className="drone-fields">
          {[
            ["wind", "Maximum wind (m/s)"],
            ["gust", "Maximum gust (m/s)"],
            ["rain", "Maximum precipitation (mm/h)"],
            ["minTemp", "Minimum temperature (°C)"],
            ["maxTemp", "Maximum temperature (°C)"],
            ["visibility", "Minimum visibility (m)"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                step="any"
                value={mission.limits[key]}
                onChange={(e) => onChange({ limits: { ...mission.limits, [key]: e.target.value, confirmed: false } })}
              />
            </label>
          ))}
          <label className="drone-wide">
            <input
              type="checkbox"
              checked={mission.limits.confirmed}
              onChange={(e) => onChange({ limits: { ...mission.limits, confirmed: e.target.checked } })}
            />
            I have confirmed these limits against the aircraft, payload, operator procedures and mission.
          </label>
        </div>
      </fieldset>
      <button disabled={!canEdit || busy || offline || !requestReady} onClick={fetchForecast} style={{ marginTop: 16 }}>
        {busy ? "Checking forecast…" : "Fetch hourly forecast"}
      </button>
      <label className="drone-note" style={{ display: "block", marginTop: 12 }}>
        <input
          type="checkbox"
          checked={autoRefresh}
          disabled={!canRefresh}
          onChange={(e) => {
            if (onChange({ weatherAutoRefresh: e.target.checked })) setAutoRefresh(e.target.checked);
          }}
        />{" "}
        Keep forecast fresh while planning
        <small style={{ display: "block" }}>
          Loads automatically when the area and dates are ready; refreshes while this panel is visible and online. Stops
          after an error. Pilot review remains required.
        </small>
      </label>
      {mission.weather && canEdit && (
        <button
          disabled={busy}
          onClick={() => {
            setAutoRefresh(false);
            onChange({ weather: null, weatherAutoRefresh: false });
          }}
          style={{ marginLeft: 10 }}
        >
          Remove forecast and use manual evidence
        </button>
      )}
      {message && (
        <p role="status" className="drone-note">
          {message}
        </p>
      )}
      {!mission.weather && (
        <p>
          {busy
            ? "Fetching the forecast for this mission…"
            : offline
              ? "Offline — forecast will wait for a connection."
              : !requestReady
                ? "Waiting for mission details. Manual weather evidence can be recorded below."
                : autoRefresh && !message
                  ? "Weather will load automatically. Pilot review is still required."
                  : "No forecast saved. Fetch when ready or record manual weather evidence below."}
        </p>
      )}
      {mission.weather && (
        <>
          <p>
            <strong>
              {freshness.current ? result.status : "Forecast is not current — review requires fresh data"}
            </strong>
          </p>
          <p role="status" className="drone-note">
            {freshness.label}
            {offline ? " · Offline: automatic refresh paused" : ""}
          </p>
          <small>
            {mission.weather.source} · fetched {mission.weather.fetchedAt} · expires {mission.weather.validUntil} ·
            model selection {mission.weather.model}. Official weather warnings are not connected.
          </small>
          <p>
            <strong>Candidate surface-weather windows ({zone})</strong>
          </p>
          {windows.length ? (
            windows.map((w) => (
              <p key={w.start}>
                {london(w.start)} – {london(w.end)}
              </p>
            ))
          ) : (
            <p>No candidate window established from the current data and confirmed limits.</p>
          )}
          {canEdit && window && (
            <button
              onClick={() =>
                onChange({
                  weatherComparisons: [
                    {
                      id: crypto.randomUUID(),
                      start: window.start,
                      end: window.end,
                      forecast: mission.weather,
                      limits: mission.limits,
                    },
                    ...(mission.weatherComparisons || []),
                  ].slice(0, 3),
                })
              }
            >
              Save forecast for date comparison
            </button>
          )}
          <div className="drone-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hour ({zone})</th>
                  <th>Point</th>
                  <th>Wind / gust m/s</th>
                  <th>Direction °</th>
                  <th>Rain mm</th>
                  <th>Rain chance %</th>
                  <th>°C</th>
                  <th>Visibility m</th>
                  <th>Cloud %</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {displayHours.map((h) => (
                  <tr key={`${h.point}-${h.at}`}>
                    <td>{london(h.at)}</td>
                    <td>{h.point}</td>
                    <td>
                      {h.wind} / {h.gust}
                    </td>
                    <td>{h.direction}</td>
                    <td>{h.rain}</td>
                    <td>{h.probability}</td>
                    <td>{h.temp}</td>
                    <td>{h.visibility}</td>
                    <td>{h.cloud}</td>
                    <td>{h.warnings.join("; ") || "Within entered limits"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Sunrise and sunset ({zone})</summary>
            {mission.weather.points.map((p, i) => (
              <div key={i}>
                <strong>Point {i + 1}</strong>
                {(p.sunrise || []).map((rise, j) => (
                  <p key={rise}>
                    {london(rise)} — {p.sunset?.[j] ? london(p.sunset[j]) : "Sunset unavailable"}
                  </p>
                ))}
              </div>
            ))}
          </details>
          <p className="drone-note">
            Weather data © Open-Meteo and contributing providers, CC BY 4.0. Recommendations do not authorise flight.
            Record your assessment below.
          </p>
        </>
      )}
      {Boolean(mission.weatherComparisons?.length) && (
        <details>
          <summary>Compare saved forecast dates</summary>
          <p>
            Historical forecasts for comparison only. They do not count as current checks. Fetch again after changing
            the mission date.
          </p>
          <div className="drone-library">
            {mission.weatherComparisons.map((c) => (
              <article key={c.id} className="drone-evidence">
                <strong>
                  {london(c.start)} – {london(c.end)}
                </strong>
                <p>Fetched {london(c.forecast.fetchedAt)}</p>
                <p>{evaluateForecast(c.forecast, mission.limits).status}</p>
                {forecastWindows(c.forecast, mission.limits, c.start, c.end).map((w) => (
                  <p key={w.start}>
                    {london(w.start)} – {london(w.end)}
                  </p>
                ))}
                {canEdit && (
                  <button
                    onClick={() =>
                      onChange({ weatherComparisons: mission.weatherComparisons.filter((x) => x.id !== c.id) })
                    }
                  >
                    Remove comparison
                  </button>
                )}
              </article>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
