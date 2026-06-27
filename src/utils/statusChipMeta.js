/** Shared status chip metadata — permit, survey, RAMS, generic. */

export function getPermitStatusMeta(derived) {
  if (derived === "closed") return { label: "Closed", tone: "neutral", icon: "●" };
  if (derived === "expired") return { label: "Expired", tone: "danger", icon: "!" };
  if (derived === "draft") return { label: "Draft", tone: "draft", icon: "•" };
  if (derived === "pending_review") return { label: "In review", tone: "draft", icon: "◔" };
  if (derived === "suspended") return { label: "Suspended", tone: "danger", icon: "⏸" };
  if (derived === "approved") return { label: "Approved", tone: "info", icon: "✓" };
  return { label: "Active", tone: "success", icon: "▶" };
}

export function getSurveyStatusMeta(status) {
  if (status === "final") return { label: "Final", tone: "success", icon: "✓" };
  return { label: "Draft", tone: "draft", icon: "•" };
}

export function getRamsStatusMeta(status) {
  const s = String(status || "draft").toLowerCase();
  if (s === "issued" || s === "approved") return { label: "Issued", tone: "success", icon: "✓" };
  if (s === "archived") return { label: "Archived", tone: "neutral", icon: "●" };
  return { label: "Draft", tone: "draft", icon: "•" };
}

export const STATUS_TONE_STYLES = {
  success: {
    bg: "var(--color-accent-muted, #EAF3DE)",
    color: "var(--color-accent, #27500A)",
    border: "var(--color-accent, #86efac)",
  },
  draft: {
    bg: "#FAEEDA",
    color: "#633806",
    border: "#fcd34d",
  },
  danger: {
    bg: "#FCEBEB",
    color: "#791F1F",
    border: "#fecaca",
  },
  info: {
    bg: "#E6F1FB",
    color: "#0C447C",
    border: "#93c5fd",
  },
  neutral: {
    bg: "var(--color-background-secondary, #f7f7f5)",
    color: "var(--color-text-secondary, #64748b)",
    border: "var(--color-border-tertiary, #e2e8f0)",
  },
  warn: {
    bg: "#FFFBEB",
    color: "#854d0e",
    border: "#fde68a",
  },
};
