/** User chose to use the workspace without Supabase sign-in (only when cloud is configured). */
export const LOCAL_WORKSPACE_FLAG = "mysafeops_local_only";

export function setLocalWorkspaceOnly(value) {
  if (value) localStorage.setItem(LOCAL_WORKSPACE_FLAG, "1");
  else localStorage.removeItem(LOCAL_WORKSPACE_FLAG);
}

export function isLocalWorkspaceOnly() {
  return localStorage.getItem(LOCAL_WORKSPACE_FLAG) === "1";
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
