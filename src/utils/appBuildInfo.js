import packageJson from "../../package.json";

/** Same logic as Help → About: optional VITE_APP_VERSION, else package.json. */
export function getDisplayAppVersion() {
  const v = import.meta.env.VITE_APP_VERSION;
  if (typeof v === "string" && v.trim()) return v.trim();
  return String(packageJson?.version || "0.0.0");
}

export function getViteMode() {
  return String(import.meta.env.MODE || "production");
}

/**
 * Supabase project ref from VITE_SUPABASE_URL host (e.g. `abcd` from `abcd.supabase.co`).
 * @returns {string} empty if missing or not hosted on *.supabase.co
 */
export function getSupabaseProjectRef() {
  const raw = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (!raw) return "";
  try {
    const host = new URL(raw).hostname;
    const ref = host.replace(/\.supabase\.co$/i, "");
    if (!ref || ref === host) return "";
    return ref;
  } catch {
    return "";
  }
}

/**
 * Supabase hosted dashboard URL for the configured project.
 * @returns {string} empty if URL missing or not *.supabase.co
 */
export function getSupabaseDashboardProjectUrl() {
  const ref = getSupabaseProjectRef();
  return ref ? `https://supabase.com/dashboard/project/${ref}` : "";
}
