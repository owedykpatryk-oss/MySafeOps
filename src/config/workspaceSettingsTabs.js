/**
 * Single source of truth for Settings centre tab ids and labels (UK English).
 * Used by SettingsCenter and workspaceNavContext.
 */
export const WORKSPACE_SETTINGS_TABS = [
  { id: "cloud", label: "Cloud account" },
  { id: "billing", label: "Billing" },
  { id: "invites", label: "Invites" },
  { id: "members", label: "Members" },
  { id: "organisation", label: "Organisation" },
  { id: "notifications", label: "Notifications" },
  { id: "developer", label: "Developer" },
];

export const WORKSPACE_SETTINGS_TAB_IDS = new Set(WORKSPACE_SETTINGS_TABS.map((t) => t.id));
