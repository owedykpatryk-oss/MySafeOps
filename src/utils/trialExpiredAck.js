import { getOrgId } from "./orgStorage";

const ackKey = (orgId = getOrgId()) => `mysafeops_trial_expired_ack_${orgId}`;

export function hasAcknowledgedTrialExpired(orgId = getOrgId()) {
  try {
    return localStorage.getItem(ackKey(orgId)) === "1";
  } catch {
    return false;
  }
}

export function acknowledgeTrialExpired(orgId = getOrgId()) {
  try {
    localStorage.setItem(ackKey(orgId), "1");
  } catch {
    /* ignore */
  }
}

export function clearTrialExpiredAck(orgId = getOrgId()) {
  try {
    localStorage.removeItem(ackKey(orgId));
  } catch {
    /* ignore */
  }
}
