import { loadOrgScoped, saveOrgScoped } from "../../utils/orgStorage";

const PREFS_KEY = "project_drawing_editor_prefs_v1";

export function loadDrawingEditorPrefs() {
  return loadOrgScoped(PREFS_KEY, { geoAnchorByProject: {}, planGeoByPlanKey: {}, version: 1 });
}

export function saveDrawingEditorPrefs(partial) {
  const cur = loadDrawingEditorPrefs();
  saveOrgScoped(PREFS_KEY, { ...cur, ...partial, version: 1 });
}
