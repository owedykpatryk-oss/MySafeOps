import { useState } from "react";
import { PERMIT_INTEGRATION_EVENTS } from "../permitIntegrationAdapters";
import { testPermitWebhook } from "../../../utils/permitWebhook";

const EVENT_IDS = PERMIT_INTEGRATION_EVENTS.map((e) => e.id);

export default function PermitIntegrationsPanel({
  config = {},
  adapters = [],
  ss = {},
  onChange,
}) {
  const [testMsg, setTestMsg] = useState({});

  const persist = (patch) => onChange?.({ ...config, ...patch });

  const toggleEvent = (eventId) => {
    const current = Array.isArray(config.events) ? config.events : EVENT_IDS;
    const next = current.includes(eventId) ? current.filter((x) => x !== eventId) : [...current, eventId];
    persist({ events: next.length ? next : EVENT_IDS });
  };

  const runTest = async (key, url, kind) => {
    setTestMsg((m) => ({ ...m, [key]: "Sending…" }));
    const r = await testPermitWebhook(url, kind);
    setTestMsg((m) => ({
      ...m,
      [key]: r.ok ? `OK (${r.status})` : `Failed: ${r.error || r.status}`,
    }));
  };

  const events = Array.isArray(config.events) ? config.events : EVENT_IDS;

  return (
    <div className="app-panel-surface ptw-integrations" style={{ padding: 10, borderRadius: 10, marginBottom: 16 }}>
      <div className="ptw-integrations__head">
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Integrations</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            Notify Slack, Teams, or your own webhook when permits are issued or closed.
          </div>
        </div>
        <span style={{ ...ss.chip, fontSize: 11 }}>Hybrid mode</span>
      </div>

      <div className="ptw-integrations__status-grid">
        {adapters.map((row) => (
          <div
            key={row.channel}
            className={`ptw-integrations__status${row.enabled ? " ptw-integrations__status--live" : ""}`}
          >
            <div className="ptw-integrations__status-top">
              <strong>{row.label || row.channel}</strong>
              <span className={`ptw-integrations__pill${row.enabled ? " ptw-integrations__pill--on" : ""}`}>
                {row.enabled ? "Live" : "Off"}
              </span>
            </div>
            <p>{row.note}</p>
          </div>
        ))}
      </div>

      <div className="ptw-integrations__events">
        <div style={{ ...ss.lbl, marginBottom: 6 }}>Events to send</div>
        <div className="ptw-integrations__event-chips">
          {PERMIT_INTEGRATION_EVENTS.map((ev) => (
            <label key={ev.id} className="ptw-integrations__event-chip">
              <input type="checkbox" checked={events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} />
              {ev.label}
            </label>
          ))}
        </div>
      </div>

      <div className="ptw-integrations__channels">
        <section className="ptw-integrations__channel">
          <label className="ptw-integrations__channel-toggle">
            <input
              type="checkbox"
              checked={Boolean(config.enabled)}
              onChange={(e) => persist({ enabled: e.target.checked })}
            />
            <strong>Custom webhook</strong>
          </label>
          <input
            value={config.url || ""}
            onChange={(e) => persist({ url: e.target.value })}
            placeholder="https://your-server.com/ptw-events"
            style={ss.inp}
          />
          <div className="ptw-integrations__channel-actions">
            <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => void runTest("generic", config.url, "generic")}>
              Send test
            </button>
            {testMsg.generic ? <span className="ptw-integrations__test-msg">{testMsg.generic}</span> : null}
          </div>
        </section>

        <section className="ptw-integrations__channel">
          <label className="ptw-integrations__channel-toggle">
            <input
              type="checkbox"
              checked={Boolean(config.slackEnabled)}
              onChange={(e) => persist({ slackEnabled: e.target.checked })}
            />
            <strong>Slack incoming webhook</strong>
          </label>
          <input
            value={config.slackUrl || ""}
            onChange={(e) => persist({ slackUrl: e.target.value })}
            placeholder="https://hooks.slack.com/services/…"
            style={ss.inp}
          />
          <div className="ptw-integrations__channel-actions">
            <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => void runTest("slack", config.slackUrl, "slack")}>
              Send test
            </button>
            {testMsg.slack ? <span className="ptw-integrations__test-msg">{testMsg.slack}</span> : null}
          </div>
        </section>

        <section className="ptw-integrations__channel">
          <label className="ptw-integrations__channel-toggle">
            <input
              type="checkbox"
              checked={Boolean(config.teamsEnabled)}
              onChange={(e) => persist({ teamsEnabled: e.target.checked })}
            />
            <strong>Microsoft Teams incoming webhook</strong>
          </label>
          <input
            value={config.teamsUrl || ""}
            onChange={(e) => persist({ teamsUrl: e.target.value })}
            placeholder="https://outlook.office.com/webhook/…"
            style={ss.inp}
          />
          <div className="ptw-integrations__channel-actions">
            <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => void runTest("teams", config.teamsUrl, "teams")}>
              Send test
            </button>
            {testMsg.teams ? <span className="ptw-integrations__test-msg">{testMsg.teams}</span> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
