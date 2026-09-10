import { localDateISO } from "../../utils/localDate";
import { getOrgMarketId } from "../../utils/orgMarket";

export const LEGAL_GOVERNANCE = {
  ownerRole: "HSE / Legal Reviewer",
  reviewCadenceDays: 180,
};

/** Default legal-content owner on a new PTW — HSE stays UK-only. */
export function legalOwnerRole(marketId = getOrgMarketId()) {
  if (marketId === "pl") return "PIP / recenzent prawny";
  if (marketId === "au") return "WHS / Legal Reviewer";
  return LEGAL_GOVERNANCE.ownerRole;
}

export function nextLegalReviewDate(fromIso = new Date().toISOString()) {
  const dt = new Date(fromIso);
  dt.setDate(dt.getDate() + LEGAL_GOVERNANCE.reviewCadenceDays);
  return localDateISO(dt);
}

