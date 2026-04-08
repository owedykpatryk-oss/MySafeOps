/** User chose to use the workspace without Supabase sign-in (only when cloud is configured). */
export const LOCAL_WORKSPACE_FLAG = "mysafeops_local_only";

export function setLocalWorkspaceOnly(value) {
  if (value) localStorage.setItem(LOCAL_WORKSPACE_FLAG, "1");
  else localStorage.removeItem(LOCAL_WORKSPACE_FLAG);
}

export function isLocalWorkspaceOnly() {
  return localStorage.getItem(LOCAL_WORKSPACE_FLAG) === "1";
}
