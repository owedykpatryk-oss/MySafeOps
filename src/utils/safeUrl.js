/**
 * Allow only http(s) links for user-controlled hrefs — blocks javascript:, data:, etc.
 * Relative paths resolve against the current origin and are allowed if the result is http(s).
 */
export function safeHttpUrl(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t, typeof window !== "undefined" ? window.location.href : "https://localhost/");
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    return null;
  }
  return null;
}
