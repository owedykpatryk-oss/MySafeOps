import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

export const PERMIT_GUIDE_STORAGE_KEY = "permit_first_run_guide_v1";

export function isPermitGuideComplete() {
  const raw = loadOrgScoped(PERMIT_GUIDE_STORAGE_KEY, null);
  return Boolean(raw?.completed);
}

export function markPermitGuideComplete(role = "") {
  saveOrgScoped(PERMIT_GUIDE_STORAGE_KEY, {
    completed: true,
    completedAt: new Date().toISOString(),
    role: String(role || "").trim() || null,
    preferQuickView: String(role || "").trim() === "operative",
  });
}

export function getPermitGuidePrefs() {
  return loadOrgScoped(PERMIT_GUIDE_STORAGE_KEY, null) || {};
}

export function shouldPreferQuickIssueView() {
  const prefs = getPermitGuidePrefs();
  return Boolean(prefs.preferQuickView);
}

export function resetPermitGuide() {
  saveOrgScoped(PERMIT_GUIDE_STORAGE_KEY, {
    completed: false,
    completedAt: null,
    role: null,
  });
}
