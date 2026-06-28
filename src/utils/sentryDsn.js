/** Validate browser Sentry DSN (public key only — safe in VITE_*). */
export function isValidSentryBrowserDsn(raw) {
  const dsn = String(raw ?? "").trim();
  if (!dsn.startsWith("https://") || !dsn.includes("@") || !dsn.includes(".ingest.")) {
    return false;
  }
  try {
    const u = new URL(dsn);
    if (u.protocol !== "https:") return false;
    const projectId = u.pathname.replace(/^\//, "").split("/")[0];
    return Boolean(u.username && projectId);
  } catch {
    return false;
  }
}

export function getSentryDsnFromEnv() {
  return String(import.meta.env.VITE_SENTRY_DSN || "").trim();
}

export function isSentryEnabledInEnv() {
  return isValidSentryBrowserDsn(getSentryDsnFromEnv());
}
