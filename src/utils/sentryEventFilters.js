/**
 * Shared Sentry noise filters — third-party scripts, shared-DSN cross-app events, etc.
 */

export const SENTRY_IGNORE_ERROR_PATTERNS = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection/i,
  /Loading chunk [\d]+ failed/i,
  /Importing a module script failed/i,
  /NetworkError when attempting to fetch resource/i,
  /Missing catch or finally after try/i,
  /Failed to execute 'appendChild' on 'Node'/i,
  /Turnstile script failed to load/i,
  /field\.offline\./i,
];

/** @param {import("@sentry/react").ErrorEvent | Record<string, unknown>} event */
export function getSentryErrorMessage(event) {
  const values = event?.exception?.values;
  const first = Array.isArray(values) ? values[0] : null;
  return String(first?.value || event?.message || "");
}

/**
 * Drop events that are not actionable app bugs (third-party script parse noise, other products on shared DSN).
 *
 * @param {import("@sentry/react").ErrorEvent | Record<string, unknown>} event
 * @param {{ originalException?: unknown }} [hint]
 */
export function shouldDropSentryEvent(event, hint = {}) {
  const original = hint?.originalException;
  const originalMsg = original instanceof Error ? original.message : String(original || "");
  const combined = `${getSentryErrorMessage(event)} ${originalMsg}`;

  if (SENTRY_IGNORE_ERROR_PATTERNS.some((re) => re.test(combined))) {
    return true;
  }

  const url = String(event?.request?.url || event?.tags?.url || "");
  if (/mypitlab\.com/i.test(url)) {
    return true;
  }

  const transaction = String(event?.transaction || event?.tags?.transaction || "");
  if (/^\/field\b/i.test(transaction) || /^\/organization\b/i.test(transaction)) {
    return true;
  }

  return false;
}
