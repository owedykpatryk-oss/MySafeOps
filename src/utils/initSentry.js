/**
 * Optional error monitoring. Set `VITE_SENTRY_DSN` in the host environment (public DSN only).
 * No-op when unset or invalid.
 */
export async function initSentryIfConfigured() {
  const dsn = (import.meta.env.VITE_SENTRY_DSN || "").trim();
  if (!dsn || !dsn.startsWith("https://") || !dsn.includes("@")) {
    return;
  }
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.12 : 1.0,
    });
  } catch {
    /* optional dependency failed to load */
  }
}
