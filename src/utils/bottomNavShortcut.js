import { NAV_TAB_IDS, MORE_TABS } from "../navigation/appModules";
import { isModuleVisible } from "./hiddenModules";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

export const BOTTOM_NAV_SHORTCUT_UPDATED_EVENT = "mysafeops-bottom-nav-shortcut-updated";

const VALID_SHORTCUT_IDS = new Set([
  ...NAV_TAB_IDS.filter((t) => !["dashboard", "more"].includes(t.id)).map((t) => t.id),
  ...MORE_TABS.map((t) => t.id),
]);

/** Default bottom-bar slot when none configured. */
export const DEFAULT_BOTTOM_NAV_FALLBACK_ID = "bin";

export function isValidBottomNavModuleId(moduleId) {
  return typeof moduleId === "string" && VALID_SHORTCUT_IDS.has(moduleId);
}

/** @returns {string|null} configured shortcut, or null → use fallback (Bin). */
export function getBottomNavModuleId() {
  if (typeof window === "undefined") return null;
  const id = loadOrgSettingsRaw().bottomNavModuleId;
  if (typeof id !== "string" || !isValidBottomNavModuleId(id)) return null;
  if (!isModuleVisible(id)) return null;
  return id;
}

/** @param {string|null} moduleId */
export function setBottomNavModuleId(moduleId) {
  const nextId = moduleId && isValidBottomNavModuleId(moduleId) ? moduleId : null;
  saveOrgSettingsRaw({
    ...loadOrgSettingsRaw(),
    bottomNavModuleId: nextId,
  });
  window.dispatchEvent(new CustomEvent(BOTTOM_NAV_SHORTCUT_UPDATED_EVENT));
}

export function getBottomNavShortcutOptions() {
  const ids = [...VALID_SHORTCUT_IDS].filter((id) => isModuleVisible(id));
  ids.sort((a, b) => a.localeCompare(b));
  return ids;
}

export function resolveBottomNavSlotId() {
  return getBottomNavModuleId() || DEFAULT_BOTTOM_NAV_FALLBACK_ID;
}
