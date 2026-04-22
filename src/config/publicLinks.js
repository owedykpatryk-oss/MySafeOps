/**
 * Public marketing / trust URLs (optional — fall back to in-app routes).
 * All VITE_* values are embedded in the client bundle.
 */
export function getPublicDocsPath() {
  const raw = (import.meta.env.VITE_PUBLIC_DOCS_PATH || "/docs").trim();
  return raw.startsWith("/") || raw.startsWith("http") ? raw : `/${raw}`;
}

export function getPublicStatusPath() {
  const external = (import.meta.env.VITE_PUBLIC_STATUS_URL || "").trim();
  if (external) return external;
  return "/status";
}
