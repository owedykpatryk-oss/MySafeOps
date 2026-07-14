import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

export const PERMIT_CONTEXT_TIPS_KEY = "permit_context_tips_dismissed_v1";

export const PTW_CONTEXT_TIPS = [
  {
    id: "command",
    target: "command",
    title: "Command strip",
    body: "Tap Active, In review, or Handover due to filter the register in one click.",
  },
  {
    id: "views",
    target: "views",
    title: "View modes",
    body: "Use Board for stand-ups, Timeline for planning, TV wall for the site office screen.",
  },
  {
    id: "bulk",
    target: "bulk",
    title: "Bulk actions",
    body: "Select filtered permits, then approve or activate as a batch at shift change.",
  },
  {
    id: "studio",
    target: "studio",
    title: "Configuration studio",
    body: "Admins: open Configure PTW to tune fields and workflow — collapsed by default.",
    adminOnly: true,
  },
];

export function loadDismissedContextTips() {
  const raw = loadOrgScoped(PERMIT_CONTEXT_TIPS_KEY, []);
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function dismissContextTip(tipId) {
  const id = String(tipId || "").trim();
  if (!id) return;
  const prev = loadDismissedContextTips();
  if (prev.includes(id)) return;
  saveOrgScoped(PERMIT_CONTEXT_TIPS_KEY, [...prev, id]);
}

export function resetContextTips() {
  saveOrgScoped(PERMIT_CONTEXT_TIPS_KEY, []);
}

export const PTW_RESET_TIPS_EVENT = "mysafeops-reset-ptw-tips";
