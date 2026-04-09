import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";

const TELEMETRY_KEY = "app_telemetry_events_v1";
const MAX_EVENTS = 500;

export function trackEvent(name, payload = {}) {
  try {
    const events = load(TELEMETRY_KEY, []);
    const next = [
      {
        name,
        payload,
        at: new Date().toISOString(),
      },
      ...events,
    ].slice(0, MAX_EVENTS);
    save(TELEMETRY_KEY, next);
  } catch {
    // No-op: telemetry should never break UX.
  }
}

export function getTelemetryEvents(limit = 50) {
  const events = load(TELEMETRY_KEY, []);
  const n = Math.max(0, Math.min(Number(limit) || 50, MAX_EVENTS));
  return events.slice(0, n);
}

export function clearTelemetryEvents() {
  save(TELEMETRY_KEY, []);
}

