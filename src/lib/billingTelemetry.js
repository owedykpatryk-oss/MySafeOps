import { trackEvent } from "../utils/telemetry";

export function trackBillingEvent(event, data = {}) {
  trackEvent(event, data);
  if (typeof window === "undefined") return;
  const sentry = window.Sentry;
  if (!sentry || typeof sentry.addBreadcrumb !== "function") return;
  sentry.addBreadcrumb({
    category: "billing",
    type: "user",
    level: "info",
    message: event,
    data,
  });
}

export function trackBillingError(event, error, data = {}) {
  const message = error?.message || String(error || "Unknown billing error");
  trackEvent(event, { ...data, message });
  if (typeof window === "undefined") return;
  const sentry = window.Sentry;
  if (!sentry) return;
  if (typeof sentry.addBreadcrumb === "function") {
    sentry.addBreadcrumb({
      category: "billing",
      type: "error",
      level: "error",
      message: event,
      data: { ...data, message },
    });
  }
  if (typeof sentry.captureException === "function") {
    sentry.captureException(error instanceof Error ? error : new Error(message), {
      tags: { area: "billing", event },
      extra: data,
    });
  }
}
