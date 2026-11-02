import { isNativeApp } from "./appRuntime.js";

/** Web keeps its same-origin API paths; a bundled WebView needs the HTTPS API host. */
export function appApiUrl(path) {
  const resolved = typeof path === "string" ? new URL(path, "https://internal.invalid") : null;
  if (
    typeof path !== "string" || !path.startsWith("/api/") || path.includes("\\") || path.includes("#") ||
    resolved.origin !== "https://internal.invalid" || !resolved.pathname.startsWith("/api/")
  ) {
    throw new Error("App API URL must be an internal /api/ path");
  }
  if (!isNativeApp()) return path;

  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  let base;
  try {
    base = new URL(configured);
  } catch {
    throw new Error("Native API origin is missing or invalid (VITE_API_BASE_URL)");
  }
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Native API origin must be an HTTPS origin without a path or credentials");
  }
  return new URL(path, base.origin).href;
}
