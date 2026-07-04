import { useMemo, useState } from "react";
import { Clock, Lock, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { isSuperAdminEmail } from "../utils/superAdmin";
import {
  billingWriteBlockedMessage,
  canExtendOrgTrial,
  isTrialExpiredWithoutPaid,
  shouldShowTrialExtensionOffer,
  TRIAL_EXTENSION_DAYS,
} from "../utils/billingAccess";
import { extendOrgTrial, getTrialExtensionCount } from "../utils/orgMembership";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";

export default function TrialBillingBanner() {
  const { trialStatus, billing, role } = useApp();
  const { user } = useSupabaseAuth();
  const { pushToast } = useToast();
  const [extending, setExtending] = useState(false);
  const isPlatformOwner = isSuperAdminEmail(user?.email);
  const trialExtensionCount = getTrialExtensionCount();

  const state = useMemo(
    () => ({
      expired: isTrialExpiredWithoutPaid({ trialStatus, billing, isPlatformOwner }),
      extendOffer: shouldShowTrialExtensionOffer({ trialStatus, billing, isPlatformOwner, trialExtensionCount }),
      canExtend: canExtendOrgTrial({ billing, isPlatformOwner, trialExtensionCount }),
    }),
    [trialStatus, billing, isPlatformOwner, trialExtensionCount]
  );

  if (!state.expired && !state.extendOffer) return null;

  const isAdmin = role === "admin";
  const cloudOk = isSupabaseConfigured() && supabase;

  const handleExtend = async () => {
    if (!cloudOk || !state.canExtend) return;
    setExtending(true);
    try {
      await extendOrgTrial(supabase);
      pushToast({
        type: "success",
        message: `Trial extended by ${TRIAL_EXTENSION_DAYS} days — full access restored.`,
      });
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Could not extend trial." });
    } finally {
      setExtending(false);
    }
  };

  if (state.expired) {
    return (
      <div className="app-trial-banner app-trial-banner--expired" role="status">
        <Lock size={18} aria-hidden />
        <div className="app-trial-banner__body">
          <strong>Trial ended — read-only mode</strong>
          <span>{billingWriteBlockedMessage()}</span>
        </div>
        <div className="app-trial-banner__actions">
          {state.canExtend && isAdmin && cloudOk ? (
            <button type="button" className="app-trial-banner__btn" disabled={extending} onClick={() => void handleExtend()}>
              {extending ? "Extending…" : `Extend +${TRIAL_EXTENSION_DAYS} days (once)`}
            </button>
          ) : null}
          <button type="button" className="app-trial-banner__btn" onClick={() => openWorkspaceView({ viewId: "backup" })}>
            Export backup
          </button>
          {isAdmin ? (
            <button type="button" className="app-trial-banner__btn app-trial-banner__btn--primary" onClick={() => openWorkspaceSettings({ tab: "billing" })}>
              Subscribe
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const daysLeft = trialStatus?.remainingDays ?? 0;

  return (
    <div className="app-trial-banner app-trial-banner--ending" role="status">
      <Clock size={18} aria-hidden />
      <div className="app-trial-banner__body">
        <strong>
          {daysLeft <= 1 ? "Trial ends soon" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in evaluation`}
        </strong>
        <span>
          Full access during trial. Need more site time? Extend once for {TRIAL_EXTENSION_DAYS} extra days, or subscribe before it ends.
        </span>
      </div>
      <div className="app-trial-banner__actions">
        {isAdmin && cloudOk ? (
          <button type="button" className="app-trial-banner__btn" disabled={extending} onClick={() => void handleExtend()}>
            <Sparkles size={14} aria-hidden />
            {extending ? "Extending…" : `Extend +${TRIAL_EXTENSION_DAYS} days`}
          </button>
        ) : null}
        {isAdmin ? (
          <button type="button" className="app-trial-banner__btn app-trial-banner__btn--primary" onClick={() => openWorkspaceSettings({ tab: "billing" })}>
            View plans
          </button>
        ) : null}
      </div>
    </div>
  );
}
