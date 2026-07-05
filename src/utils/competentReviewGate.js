/**
 * Competent-person review acknowledgement — aligns with Terms §4.2 (not legal advice).
 */

export const COMPETENT_REVIEW_LABEL =
  "I confirm a competent person has reviewed this for site use. MySafeOps outputs are not legal or engineering advice.";

/** @param {string} status */
export function requiresCompetentReviewForRamsStatus(status) {
  return ["approved", "issued"].includes(String(status || "").toLowerCase());
}

/** @param {"approve"|"activate"|"close"} action */
export function requiresCompetentReviewForPermitAction(action) {
  return action === "approve" || action === "activate" || action === "close";
}

/**
 * Browser confirm gate before high-risk workflow steps.
 * @param {string} actionLabel e.g. "approve this RAMS"
 * @returns {boolean}
 */
export function gateCompetentReview(actionLabel) {
  if (typeof window === "undefined") return true;
  return window.confirm(
    `Before you ${actionLabel}:\n\n${COMPETENT_REVIEW_LABEL}\n\nPress OK to confirm competent review.`
  );
}

/**
 * @param {Record<string, unknown>} record
 * @param {{ by?: string }} [meta]
 */
export function stampCompetentReview(record, meta = {}) {
  const at = new Date().toISOString();
  return {
    ...record,
    competentReviewAcknowledgedAt: at,
    competentReviewAcknowledgedBy: String(meta.by || "").trim() || "Reviewer",
  };
}
