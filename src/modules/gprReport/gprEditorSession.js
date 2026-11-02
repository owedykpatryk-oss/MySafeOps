const LOCK_KEY = "mysafeops_gpr_editor_open";
const DATA_KEY = "mysafeops_gpr_editor_draft";

export function isGprEditorLocked() {
  try {
    return sessionStorage.getItem(LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function readGprEditorSession() {
  try {
    const raw = sessionStorage.getItem(DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGprEditorSession(session) {
  try {
    sessionStorage.setItem(LOCK_KEY, "1");
    sessionStorage.setItem(DATA_KEY, JSON.stringify(session));
  } catch {
    try {
      sessionStorage.setItem(LOCK_KEY, "1");
    } catch {
      /* private mode */
    }
  }
}

export function clearGprEditorSession() {
  try {
    sessionStorage.removeItem(LOCK_KEY);
    sessionStorage.removeItem(DATA_KEY);
  } catch {
    /* ignore */
  }
}
