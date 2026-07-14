/** UK-friendly labels for PTW workflow states (config studio). */
export const PERMIT_WORKFLOW_STATE_LABELS = {
  draft: "Draft",
  ready_for_review: "In review",
  approved: "Approved",
  issued: "Active on site",
  suspended: "Suspended",
  closed: "Closed",
};

export const PERMIT_WORKFLOW_STATES = Object.keys(PERMIT_WORKFLOW_STATE_LABELS);

/** SVG layout for the visual workflow designer (viewBox 0 0 720 260). */
export const PERMIT_WORKFLOW_NODE_LAYOUT = {
  draft: { x: 72, y: 88 },
  ready_for_review: { x: 200, y: 88 },
  approved: { x: 328, y: 88 },
  issued: { x: 456, y: 88 },
  closed: { x: 584, y: 88 },
  suspended: { x: 456, y: 188 },
};

export function labelWorkflowState(state) {
  const key = String(state || "").trim().toLowerCase();
  return PERMIT_WORKFLOW_STATE_LABELS[key] || key.replace(/_/g, " ");
}
