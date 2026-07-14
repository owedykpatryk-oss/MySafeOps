import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

export const PERMIT_GUIDE_STORAGE_KEY = "permit_first_run_guide_v1";
export const PTW_REPLAY_GUIDE_EVENT = "mysafeops-replay-ptw-guide";

let guideCloudSync = null;

/** Register async sync (Supabase) after local save — set from PermitSystem. */
export function registerPermitGuideCloudSync(fn) {
  guideCloudSync = typeof fn === "function" ? fn : null;
}

export function isPermitGuideComplete() {
  const raw = loadOrgScoped(PERMIT_GUIDE_STORAGE_KEY, null);
  return Boolean(raw?.completed);
}

export function markPermitGuideComplete(role = "") {
  const payload = {
    completed: true,
    completedAt: new Date().toISOString(),
    role: String(role || "").trim() || null,
    preferQuickView: String(role || "").trim() === "operative",
  };
  saveOrgScoped(PERMIT_GUIDE_STORAGE_KEY, payload);
  try {
    guideCloudSync?.(payload);
  } catch {
    /* non-fatal */
  }
}

export function getPermitGuidePrefs() {
  return loadOrgScoped(PERMIT_GUIDE_STORAGE_KEY, null) || {};
}

export function shouldPreferQuickIssueView() {
  const prefs = getPermitGuidePrefs();
  return Boolean(prefs.preferQuickView);
}

export function resetPermitGuide() {
  const payload = {
    completed: false,
    completedAt: null,
    role: null,
    preferQuickView: false,
  };
  saveOrgScoped(PERMIT_GUIDE_STORAGE_KEY, payload);
  try {
    guideCloudSync?.(payload);
  } catch {
    /* non-fatal */
  }
}
