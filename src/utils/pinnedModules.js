import { MORE_TABS } from "../navigation/appModules";

const STORAGE_KEY = "mysafeops_pinned_modules_v1";
const MAX_PINS = 12;

const VALID_IDS = new Set(MORE_TABS.map((t) => t.id));

function parseStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((id) => typeof id === "string" && VALID_IDS.has(id)).slice(0, MAX_PINS);
  } catch {
    return [];
  }
}

export function getPinnedModuleIds() {
  if (typeof window === "undefined") return [];
  return parseStored();
}

/**
 * Toggle pin for a More module. Returns the new ordered id list.
 * @param {string} moduleId
 */
export function togglePinnedModule(moduleId) {
  if (!VALID_IDS.has(moduleId)) return getPinnedModuleIds();
  let ids = parseStored();
  if (ids.includes(moduleId)) {
    ids = ids.filter((x) => x !== moduleId);
  } else {
    if (ids.length >= MAX_PINS) {
      ids = ids.slice(1);
    }
    ids = [...ids, moduleId];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  return ids;
}
