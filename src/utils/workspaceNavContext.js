const STORAGE_KEY = "mysafeops_workspace_nav_target";

/**
 * Set focus target for the next visit to a workspace screen (consumed once).
 * @param {{ viewId: string, permitId?: string }} target
 */
export function setWorkspaceNavTarget(target) {
  if (!target?.viewId) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @returns {{ viewId?: string, permitId?: string } | null}
 */
export function peekWorkspaceNavTarget() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

/** Read and clear nav target (call when the destination view has handled it). */
export function consumeWorkspaceNavTarget() {
  const v = peekWorkspaceNavTarget();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return v;
}
