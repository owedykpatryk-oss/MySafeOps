import { isNativeApp } from "./appRuntime";

const DEFAULT_PUBLIC_ORIGIN = "https://mysafeops.com";

/** Shareable links must never point at the native WebView's local server. */
export function getPublicAppOrigin() {
  if (!isNativeApp() && typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)) {
    // Preserve localhost and preview deployments for web QA.
    return window.location.origin;
  }
  try {
    const url = new URL(String(import.meta.env.VITE_PUBLIC_SITE_URL || "").trim());
    if (url.protocol === "https:" && !url.username && !url.password) return url.origin;
  } catch {
    // The production origin is also the default for the site's canonical URLs.
  }
  return DEFAULT_PUBLIC_ORIGIN;
}

/** Public links only; OAuth callbacks and internal navigation have separate flows. */
export function publicAppUrl(path = "/app") {
  const origin = getPublicAppOrigin();
  const url = new URL(path, origin);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || url.origin !== origin) {
    throw new Error("Public app links require an internal path");
  }
  return url.href;
}
