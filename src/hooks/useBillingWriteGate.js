import { useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import {
  billingWriteBlockedMessage,
  canExtendOrgTrial,
  isBillingWriteBlocked,
  isTrialExpiredWithoutPaid,
  notifyBillingWriteBlocked,
  shouldShowTrialExtensionOffer,
} from "../utils/billingAccess";
import { isSuperAdminEmail } from "../utils/superAdmin";

/** Central read-only / trial billing gate for workspace modules. */
export function useBillingWriteGate() {
  const { trialStatus, billing, trialExtensionCount } = useApp();
  const { user } = useSupabaseAuth();
  const isPlatformOwner = isSuperAdminEmail(user?.email);

  const opts = useMemo(
    () => ({ trialStatus, billing, isPlatformOwner, trialExtensionCount }),
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
    isPlatformOwner,
  };
}
