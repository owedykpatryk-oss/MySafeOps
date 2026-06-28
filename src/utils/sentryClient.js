/**
 * Thin helpers for optional Sentry — safe no-op when monitoring is off.
 * `bootSentryIfConfigured()` assigns `window.Sentry` for legacy call sites.
 */

export function getSentry() {
  if (typeof window === "undefined") return null;
  return window.Sentry || null;
}

export function syncSentryUser(user) {
  const Sentry = getSentry();
  if (!Sentry || typeof Sentry.setUser !== "function") return;
  if (!user?.id) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: String(user.id) });
}

export function captureSentryException(error, context = {}) {
  const Sentry = getSentry();
  if (!Sentry || typeof Sentry.captureException !== "function") return;
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), context);
}

export function addSentryBreadcrumb(breadcrumb) {
  const Sentry = getSentry();
  if (!Sentry || typeof Sentry.addBreadcrumb !== "function") return;
  Sentry.addBreadcrumb(breadcrumb);
}
