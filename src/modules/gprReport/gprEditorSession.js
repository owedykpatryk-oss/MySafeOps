import { countryOperationalStorageKey } from "../../utils/orgStorage";
import { getCachedAuthorshipActor } from "../../utils/documentAuthorship";

export function getGprEditorScope(userId = getCachedAuthorshipActor()?.id || "anonymous") {
  return JSON.stringify([userId, countryOperationalStorageKey("gpr_reports")]);
}

function sessionKey(scope) {
  return `mysafeops_gpr_editor_draft_v2:${encodeURIComponent(scope)}`;
}

export function isGprEditorLocked() {
  return Boolean(readGprEditorSession());
}

export function readGprEditorSession(scope = getGprEditorScope()) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(sessionKey(scope)) || "null");
    return parsed?.scope === scope && parsed?.data?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function writeGprEditorSession(session, scope = getGprEditorScope()) {
  try {
    sessionStorage.setItem(sessionKey(scope), JSON.stringify({ ...session, scope }));
    return true;
  } catch {
    return false;
  }
}

export function clearGprEditorSession(scope = getGprEditorScope()) {
  try {
    sessionStorage.removeItem(sessionKey(scope));
  } catch {
    /* Keep the recovery copy if storage is inaccessible. */
  }
}
