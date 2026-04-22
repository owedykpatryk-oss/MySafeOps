/**
 * IT / self-host setup hints (Supabase redirect URLs, .env keys) on login and cloud account.
 * Hidden in production builds unless explicitly enabled (keeps end-user UI clean for audits).
 * - Always shown in `npm run dev`
 * - In preview/staging: set VITE_SHOW_LOGIN_ADMIN_HINTS=true
 */
export function showAdminLoginHints() {
  if (import.meta.env.DEV) return true;
  return String(import.meta.env.VITE_SHOW_LOGIN_ADMIN_HINTS || "")
    .trim()
    .toLowerCase() === "true";
}
