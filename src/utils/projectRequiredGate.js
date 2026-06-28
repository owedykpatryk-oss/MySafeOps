import { openWorkspaceView, setWorkspaceNavTarget } from "./workspaceNavContext";
import { isAutomationEnabled } from "./orgAutomationRules";

/**
 * Soft gate: site-linked documents should belong to a project.
 * @returns {boolean} true if OK to proceed
 */
export function ensureProjectLinked({ projectId, projects = [], moduleLabel = "record" }) {
  if (!isAutomationEnabled("requireProjectLink")) return true;
  const pid = String(projectId || "").trim();
  if (pid && projects.some((p) => p.id === pid)) return true;

  if (!projects.length) {
    window.alert(`Add a project first — every ${moduleLabel} should be linked to a site.`);
    setWorkspaceNavTarget({ viewId: "projects", action: "createProject" });
    openWorkspaceView({ viewId: "projects" });
    return false;
  }

  window.alert(`Select a project for this ${moduleLabel} before saving.`);
  return false;
}

/** Pick default project when creating from list (single active site). */
export function defaultProjectIdForCreate(projects = []) {
  const active = (projects || []).filter((p) => !p.closed);
  return active.length === 1 ? active[0].id : "";
}
