/**
 * Optional Sentry bootstrap — non-blocking; call after first paint.
 * No-op when `VITE_SENTRY_DSN` is missing or invalid.
 */
import { getDisplayAppVersion } from "./utils/appBuildInfo.js";
import { getSentryDsnFromEnv, isValidSentryBrowserDsn } from "./utils/sentryDsn.js";
import { SENTRY_IGNORE_ERROR_PATTERNS, shouldDropSentryEvent } from "./utils/sentryEventFilters.js";

export const SENTRY_ENABLED = isValidSentryBrowserDsn(getSentryDsnFromEnv());

function tracePropagationTargets() {
  const targets = [/^https?:\/\/localhost\b/, /^\/api\//];
  for (const key of ["VITE_SUPABASE_URL", "VITE_D1_API_URL", "VITE_STORAGE_API_URL"]) {
    const raw = String(import.meta.env[key] || "").trim();
    if (raw) targets.push(raw);
  }
  return targets;
}

function scrubEventRequest(event) {
  const url = event?.request?.url;
  if (!url) return event;
  try {
    const u = new URL(url);
    for (const key of ["portal", "subcontractor", "ramsShare", "permitAck", "access_token", "refresh_token"]) {
      if (u.searchParams.has(key)) u.searchParams.set(key, "[Filtered]");
    }
    event.request.url = u.toString();
  } catch {
    /* ignore malformed URLs */
  }
  return event;
}

/** @returns {Promise<typeof import("@sentry/react") | null>} */
export async function bootSentryIfConfigured() {
  if (!SENTRY_ENABLED) return null;
  if (typeof window !== "undefined" && window.Sentry) {
    return window.Sentry;
  }

  try {
    const [Sentry, React, router] = await Promise.all([
      import("@sentry/react"),
      import("react"),
      import("react-router-dom"),
    ]);

    const integrations = [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ];

    if (router.useLocation && router.matchRoutes) {
      integrations.push(
        Sentry.reactRouterV7BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation: router.useLocation,
          useNavigationType: router.useNavigationType,
          createRoutesFromChildren: router.createRoutesFromChildren,
          matchRoutes: router.matchRoutes,
        })
      );
    }

    Sentry.init({
      dsn: getSentryDsnFromEnv(),
      environment: import.meta.env.MODE,
      release: `mysafeops@${getDisplayAppVersion()}`,
      integrations,
      tracesSampleRate: import.meta.env.PROD ? 0.12 : 1.0,
      replaysSessionSampleRate: import.meta.env.PROD ? 0.05 : 0,
      replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
      tracePropagationTargets: tracePropagationTargets(),
      ignoreErrors: SENTRY_IGNORE_ERROR_PATTERNS,
      beforeSend(event, hint) {
        if (shouldDropSentryEvent(event, hint)) return null;
        return scrubEventRequest(event);
      },
    });

    if (typeof window !== "undefined") {
      window.Sentry = Sentry;
    }
    return Sentry;
  } catch {
    return null;
  }
}
