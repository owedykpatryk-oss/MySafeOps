/**
 * Cloud merge for custom workspace profiles — orgId/localStorage only (no orgStorage cycle).
 */
import { getOrgId, orgScopedKey } from "./orgId";

const LEGACY_SCOPED_KEY = "custom_workspace_profiles";
const ORG_SETTINGS_BASE_KEY = "mysafeops_org_settings";

/** @param {unknown} id */
export function isCustomWorkspacePackId(id) {
  return typeof id === "string" && id.startsWith("custom_");
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object" || !raw.custom || typeof raw.id !== "string" || !raw.id.startsWith("custom_")) {
    return null;
  }
  return raw;
}

function loadOrgSettingsForCloudMerge() {
  try {
    const scoped = localStorage.getItem(orgScopedKey(ORG_SETTINGS_BASE_KEY));
    if (scoped) {
      const parsed = JSON.parse(scoped);
      if (parsed && typeof parsed === "object") return parsed;
    }
    const legacy = JSON.parse(localStorage.getItem(ORG_SETTINGS_BASE_KEY) || "{}");
    return legacy && typeof legacy === "object" ? legacy : {};
  } catch {
    return {};
  }
}

function saveOrgSettingsForCloudMerge(value) {
  localStorage.setItem(orgScopedKey(ORG_SETTINGS_BASE_KEY), JSON.stringify(value));
}

function persistCustomWorkspaceProfiles(profiles) {
  const list = profiles.map((p) => ({ ...p, custom: true }));
  localStorage.setItem(orgScopedKey(LEGACY_SCOPED_KEY), JSON.stringify(list));
  const raw = loadOrgSettingsForCloudMerge();
  saveOrgSettingsForCloudMerge({ ...raw, customWorkspaceProfiles: list, orgId: raw.orgId || getOrgId() });
}

/** Merge cloud-pulled profiles into local org settings (org-private). */
export function mergeCustomProfilesFromCloudSettings(cloudSettings) {
  if (!cloudSettings || !Array.isArray(cloudSettings.customWorkspaceProfiles)) return false;
  const incoming = cloudSettings.customWorkspaceProfiles.map(normalizeProfile).filter(Boolean);
  if (!incoming.length) return false;
  persistCustomWorkspaceProfiles(incoming);
  return true;
}
