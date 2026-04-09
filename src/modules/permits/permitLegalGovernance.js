export const LEGAL_GOVERNANCE = {
  ownerRole: "HSE / Legal Reviewer",
  reviewCadenceDays: 180,
};

export function nextLegalReviewDate(fromIso = new Date().toISOString()) {
  const dt = new Date(fromIso);
  dt.setDate(dt.getDate() + LEGAL_GOVERNANCE.reviewCadenceDays);
  return dt.toISOString().slice(0, 10);
}

