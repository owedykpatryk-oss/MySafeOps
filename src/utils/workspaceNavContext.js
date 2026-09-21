import { WORKSPACE_VIEW_ID_SET } from "../navigation/workspaceViewIds.js";
import { WORKSPACE_SETTINGS_TAB_IDS } from "../config/workspaceSettingsTabs.js";

const STORAGE_KEY = "mysafeops_workspace_nav_target";

export { WORKSPACE_SETTINGS_TAB_IDS };

export const OPEN_WORKSPACE_VIEW_EVENT = "mysafeops:open-view";
export const OPEN_WORKSPACE_MORE_EVENT = "mysafeops:open-more";

/**
 * Open More tab with optional HSE/Site section register filter.
 * @param {{ sectionTitle?: string, registerFilter?: 'all'|'attention'|'empty'|'active' }} [detail]
 */
export function openWorkspaceMoreSection(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_WORKSPACE_MORE_EVENT, { detail: detail || {} }));
  } catch {
    /* ignore */
  }
}

/**
 * Open a workspace module by id (same as choosing it from the bottom bar or More grid).
 * @param {{ viewId: string }} detail — e.g. `workers`, `rams`, `permits`, `help`
 */
export function openWorkspaceView(detail = {}) {
  const viewId = detail?.viewId;
  if (!viewId || !WORKSPACE_VIEW_ID_SET.has(viewId)) return;
  try {
    window.dispatchEvent(new CustomEvent(OPEN_WORKSPACE_VIEW_EVENT, { detail: { viewId } }));
  } catch {
    /* ignore */
  }
}

export const OPEN_WORKSPACE_SETTINGS_EVENT = "mysafeops:open-settings";

/**
 * Open Settings (More → Settings) and optionally focus a tab.
 * @param {{ tab?: string }} [detail] — tab id, default `organisation` (onboarding).
 */
export function openWorkspaceSettings(detail = {}) {
  const raw = detail?.tab;
  const tab = raw && WORKSPACE_SETTINGS_TAB_IDS.has(raw) ? raw : "organisation";
  try {
    window.dispatchEvent(new CustomEvent(OPEN_WORKSPACE_SETTINGS_EVENT, { detail: { tab } }));
  } catch {
    /* ignore */
  }
}

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

/**
 * Open Help Centre focused on a guided task and/or section anchor.
 * HelpAbout consumes `{ viewId: "help", guideId, section }` once on mount.
 * @param {{ guideId?: string, section?: string }} [opts]
 */
export function openHelpGuide(opts = {}) {
  const guideId = opts?.guideId ? String(opts.guideId) : undefined;
  const section = opts?.section ? String(opts.section) : guideId ? "help-guides" : "help-start";
  setWorkspaceNavTarget({ viewId: "help", guideId, section });
  openWorkspaceView({ viewId: "help" });
}
