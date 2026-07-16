/** Legacy flag — must never elevate privileges when cloud auth is configured. */
export const LOCAL_WORKSPACE_FLAG = "mysafeops_local_only";

/**
 * @deprecated Prefer device-only mode via missing Supabase env.
 * Writing this flag no longer grants admin when a cloud session exists (see AppContext).
 */
export function setLocalWorkspaceOnly(value) {
  if (value) localStorage.setItem(LOCAL_WORKSPACE_FLAG, "1");
  else localStorage.removeItem(LOCAL_WORKSPACE_FLAG);
}

/** Raw flag read — do not use for privilege decisions when cloud is configured. */
export function isLocalWorkspaceOnly() {
  return localStorage.getItem(LOCAL_WORKSPACE_FLAG) === "1";
}

/** Clear the legacy flag (call after cloud sign-in). */
export function clearLocalWorkspaceOnlyFlag() {
  try {
    localStorage.removeItem(LOCAL_WORKSPACE_FLAG);
  } catch {
    /* ignore */
  }
}

/** True when a Supabase session token is stored (user signed in on this device). */
export function hasPersistedSupabaseSession() {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    if (!key) return false;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const token =
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token;
    return Boolean(token);
  } catch {
    return false;
  }
}
