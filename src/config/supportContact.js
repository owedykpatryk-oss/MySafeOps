/** Public support inbox — safe in Vite bundle (not a secret). */
const DEFAULT = "support@mysafeops.com";

function isLooseEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

/** Shown in UI, mailto links, and footers. Override with `VITE_SUPPORT_EMAIL`. */
export function getSupportEmail() {
  const v = (import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
  return isLooseEmail(v) ? v.trim() : DEFAULT;
}

export const DEFAULT_SUPPORT_EMAIL = DEFAULT;
