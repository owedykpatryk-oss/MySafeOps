import { useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import {
  billingWriteBlockedMessage,
  canExtendOrgTrial,
  isBillingWriteBlocked,
  isTrialExpiredWithoutPaid,
  notifyBillingWriteBlocked,
  shouldShowTrialExtensionOffer,
} from "../utils/billingAccess";

/** Central read-only / trial billing gate for workspace modules. */
export function useBillingWriteGate() {
  const { trialStatus, billing, trialExtensionCount, isPlatformOwner } = useApp();

  const opts = useMemo(
    () => ({ trialStatus, billing, isPlatformOwner: Boolean(isPlatformOwner), trialExtensionCount }),
    [trialStatus, billing, isPlatformOwner, trialExtensionCount]
  );

  const writeBlocked = isBillingWriteBlocked(opts);
  const trialExpired = isTrialExpiredWithoutPaid(opts);
  const canExtend = canExtendOrgTrial(opts);
  const showExtensionOffer = shouldShowTrialExtensionOffer(opts);
  const message = billingWriteBlockedMessage();

  const guardAction = useCallback(
    (fn, { toastDetail } = {}) => {
      if (!writeBlocked) return fn();
      notifyBillingWriteBlocked(toastDetail || {});
      return false;
    },
    [writeBlocked]
  );

  return {
    writeBlocked,
    trialExpired,
    canExtend,
    showExtensionOffer,
    message,
    guardAction,
    isPlatformOwner: Boolean(isPlatformOwner),
  };
}
