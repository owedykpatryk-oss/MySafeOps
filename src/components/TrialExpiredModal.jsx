import { useMemo, useState } from "react";
import { Download, Lock, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { isSuperAdminEmail } from "../utils/superAdmin";
import {
  billingWriteBlockedMessage,
  canExtendOrgTrial,
  isTrialExpiredWithoutPaid,
  TRIAL_EXTENSION_DAYS,
} from "../utils/billingAccess";
import { extendOrgTrial } from "../utils/orgMembership";
import { acknowledgeTrialExpired, hasAcknowledgedTrialExpired } from "../utils/trialExpiredAck";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";

/**
 * One-time modal when cloud evaluation ends — explains read-only mode and next steps.
 */
export default function TrialExpiredModal() {
  const { orgId, trialStatus, billing, role } = useApp();
  const { user } = useSupabaseAuth();
  const [dismissed, setDismissed] = useState(false);
  const [extending, setExtending] = useState(false);
  const isPlatformOwner = isSuperAdminEmail(user?.email);
  const isAdmin = role === "admin";
  const cloudOk = isSupabaseConfigured() && supabase;

  const visible = useMemo(() => {
    if (dismissed || isPlatformOwner) return false;
    if (!isTrialExpiredWithoutPaid({ trialStatus, billing, isPlatformOwner })) return false;
    return !hasAcknowledgedTrialExpired(orgId);
  }, [dismissed, isPlatformOwner, trialStatus, billing, orgId]);

  const canExtend = canExtendOrgTrial({ billing, isPlatformOwner });

  if (!visible) return null;

  const close = () => {
    acknowledgeTrialExpired(orgId);
    setDismissed(true);
  };

  const handleExtend = async () => {
    if (!cloudOk || !canExtend) return;
    setExtending(true);
    try {
      await extendOrgTrial(supabase);
      acknowledgeTrialExpired(orgId);
      setDismissed(true);
    } catch {
      /* banner/toast elsewhere */
    } finally {
      setExtending(false);
    }
  };

  return (
    <div className="app-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="trial-expired-title">
      <div className="app-onboarding-panel app-panel-surface app-trial-expired-modal">
        <div className="app-onboarding-icon app-trial-expired-modal__icon" aria-hidden>
          <Lock size={28} strokeWidth={2} />
        </div>
        <h2 id="trial-expired-title" className="app-onboarding-title">
          Evaluation ended
        </h2>
        <p className="app-onboarding-lead">{billingWriteBlockedMessage()}</p>
        <ul className="app-trial-expired-modal__list">
          <li>View existing RAMS, permits, registers and dashboards</li>
          <li>Download a JSON backup anytime (More → Backup)</li>
          <li>Subscribe to resume creating and editing records</li>
        </ul>
        <div className="app-trial-expired-modal__actions">
          {isAdmin && canExtend && cloudOk ? (
            <button type="button" className="app-onboarding-primary" disabled={extending} onClick={() => void handleExtend()}>
              <Sparkles size={16} aria-hidden />
              {extending ? "Extending…" : `Extend +${TRIAL_EXTENSION_DAYS} days (once)`}
            </button>
          ) : null}
          {isAdmin ? (
            <button type="button" className="app-onboarding-primary" onClick={() => { openWorkspaceSettings({ tab: "billing" }); close(); }}>
              View plans & subscribe
            </button>
          ) : null}
          <button
            type="button"
            className="app-onboarding-secondary"
            onClick={() => {
              openWorkspaceView({ viewId: "backup" });
              close();
            }}
          >
            <Download size={16} aria-hidden />
            Open backup & export
          </button>
          <button type="button" className="app-onboarding-secondary" onClick={close}>
            Continue read-only
          </button>
        </div>
      </div>
    </div>
  );
}
