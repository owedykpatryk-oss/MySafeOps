import { MORE_TABS, NAV_TAB_IDS } from "../navigation/appModules";

const STORAGE_KEY = "mysafeops_recent_modules_v1";
const MAX_RECENT = 5;

const VALID_RECENT_IDS = new Set([
  ...NAV_TAB_IDS.filter((t) => t.id !== "more").map((t) => t.id),
  ...MORE_TABS.map((t) => t.id),
]);

/**
 * Last opened workspace module ids (most recent first). Used by Search shortcuts.
 */
export function getRecentModuleIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((id) => typeof id === "string" && VALID_RECENT_IDS.has(id)).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/**
 * Call when the user opens a workspace screen (dashboard, permits, a More module, etc.).
 * @param {string} viewId
 */
export function recordRecentModule(viewId) {
  if (!viewId || !VALID_RECENT_IDS.has(viewId)) return;
  const prev = getRecentModuleIds();
  const next = [viewId, ...prev.filter((id) => id !== viewId)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
