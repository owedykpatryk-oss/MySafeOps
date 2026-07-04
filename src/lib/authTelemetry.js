/**
 * Lightweight auth telemetry hook.
 * - Always writes auth breadcrumbs when Sentry is available on window.
 * - Safe no-op when Sentry is not present.
 */

function redactEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return undefined;
  const [local, domain] = e.split("@");
  if (!local || !domain) return undefined;
  const hint = local.length <= 2 ? `${local[0] || ""}*` : `${local.slice(0, 2)}…`;
  return `${hint}@${domain}`;
}

function scrubAuthData(data) {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };
  if ("email" in out) {
    const redacted = redactEmail(out.email);
    if (redacted) out.email = redacted;
    else delete out.email;
  }
  return out;
}

export function trackAuthEvent(event, data = {}) {
  if (typeof window === "undefined") return;
  const sentry = window.Sentry;
  if (!sentry || typeof sentry.addBreadcrumb !== "function") return;

  sentry.addBreadcrumb({
    category: "auth",
    type: "user",
    level: "info",
    message: event,
    data: scrubAuthData(data),
  });
}

export function trackAuthError(event, error, data = {}) {
  if (typeof window === "undefined") return;
  const sentry = window.Sentry;
  if (!sentry) return;

  const message = error?.message || String(error || "Unknown auth error");
  const scrubbed = scrubAuthData(data);
  if (typeof sentry.addBreadcrumb === "function") {
    sentry.addBreadcrumb({
      category: "auth",
      type: "error",
      level: "error",
      message: event,
      data: { ...scrubbed, message },
    });
  }
  if (typeof sentry.captureException === "function") {
    sentry.captureException(error instanceof Error ? error : new Error(message), {
      tags: { area: "auth", event },
      extra: scrubbed,
    });
  }
}

