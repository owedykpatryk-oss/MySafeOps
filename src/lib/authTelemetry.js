/**
 * Lightweight auth telemetry hook.
 * - Always writes auth breadcrumbs when Sentry is available on window.
 * - Safe no-op when Sentry is not present.
 */
export function trackAuthEvent(event, data = {}) {
  if (typeof window === "undefined") return;
  const sentry = window.Sentry;
  if (!sentry || typeof sentry.addBreadcrumb !== "function") return;

  sentry.addBreadcrumb({
    category: "auth",
    type: "user",
    level: "info",
    message: event,
    data,
  });
}

export function trackAuthError(event, error, data = {}) {
  if (typeof window === "undefined") return;
  const sentry = window.Sentry;
  if (!sentry) return;

  const message = error?.message || String(error || "Unknown auth error");
  if (typeof sentry.addBreadcrumb === "function") {
    sentry.addBreadcrumb({
      category: "auth",
      type: "error",
      level: "error",
      message: event,
      data: { ...data, message },
    });
  }
  if (typeof sentry.captureException === "function") {
    sentry.captureException(error instanceof Error ? error : new Error(message), {
      tags: { area: "auth", event },
      extra: data,
    });
  }
}

